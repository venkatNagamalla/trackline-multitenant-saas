
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify


from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.tokens import RefreshToken

from audit.models import AuditLog

from .tasks import send_invitation_email

from .models import User, Workspace, Membership, Invitation
from .permissions import IsWorkspaceMember, RolePermission
from .serializers import (
    SignupSerializer,
    LoginSerializer,
    InvitationSerializer,
    AcceptInvitationSerializer,
    MemberRoleUpdateSerializer,
)


class SignupView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        username = serializer.validated_data["username"]
        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        workspace_name = serializer.validated_data["workspace_name"]

        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
            )

            base_slug = slugify(workspace_name) or "workspace"
            slug = base_slug
            counter = 1

            while Workspace.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1

            workspace = Workspace.objects.create(
                name=workspace_name,
                slug=slug,
            )

            Membership.objects.create(
                user=user,
                workspace=workspace,
                role=Membership.ADMIN,
            )

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": "Signup successful",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                },
                "workspace": {
                    "id": workspace.id,
                    "name": workspace.name,
                    "slug": workspace.slug,
                    "role": Membership.ADMIN,
                },
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": "Login successful",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                },
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
            },
            status=status.HTTP_200_OK,
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        memberships = Membership.objects.filter(
            user=user
        ).select_related("workspace")

        workspaces = [
            {
                "id": membership.workspace.id,
                "name": membership.workspace.name,
                "slug": membership.workspace.slug,
                "role": membership.role,
            }
            for membership in memberships
        ]

        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "workspaces": workspaces,
            },
            status=status.HTTP_200_OK,
        )


class InvitationCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        workspace_slug = request.headers.get("X-Workspace")

        if not workspace_slug:
            return Response(
                {"detail": "X-Workspace header is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = Membership.objects.filter(
            user=request.user,
            workspace__slug=workspace_slug,
        ).select_related("workspace").first()

        if membership is None:
            return Response(
                {"detail": "You are not a member of this workspace."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Temporary debugging information
        print("DEBUG USER:", request.user.email)
        print("DEBUG WORKSPACE:", membership.workspace.slug)
        print("DEBUG ROLE:", membership.role)

        if membership.role != Membership.ADMIN:
            raise PermissionDenied(
                "Only workspace admins can create invitations."
            )

        serializer = InvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]

        existing_user = User.objects.filter(
            email__iexact=email,
        ).first()

        if existing_user and Membership.objects.filter(
            user=existing_user,
            workspace=membership.workspace,
        ).exists():
            return Response(
                {"detail": "This user is already a workspace member."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invitation, created = Invitation.objects.get_or_create(
            workspace=membership.workspace,
            email=email,
            accepted_at__isnull=True,
            defaults={
                "role": serializer.validated_data["role"],
            },
        )

        if not created:
            invitation.role = serializer.validated_data["role"]
            invitation.save(update_fields=["role"])

        # Queue invitation email after the database transaction commits.
        transaction.on_commit(
            lambda invitation_id=invitation.id:
                send_invitation_email.delay(invitation_id)
        )

        return Response(
            {
                "message": "Invitation created successfully.",
                "invitation": {
                    "id": invitation.id,
                    "email": invitation.email,
                    "role": invitation.role,
                    "token": str(invitation.token),
                    "invite_link": f"/invite/{invitation.token}",
                    "accepted_at": invitation.accepted_at,
                },
            },
            status=status.HTTP_201_CREATED,
        )

class InvitationAcceptView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request, token):
        invitation = (
            Invitation.objects.select_for_update()
            .filter(
                token=token,
                accepted_at__isnull=True,
            )
            .select_related("workspace")
            .first()
        )

        if invitation is None:
            return Response(
                {
                    "detail": (
                        "Invalid or already accepted invitation."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AcceptInvitationSerializer(
            data=request.data,
            context={"invitation": invitation},
        )
        serializer.is_valid(raise_exception=True)

        email = invitation.email.strip().lower()
        is_new_user = serializer.validated_data["is_new_user"]
        user = serializer.validated_data["user"]

        if is_new_user:
            user = User(
                username=serializer.validated_data["username"],
                email=email,
            )
            user.set_password(
                serializer.validated_data["password"]
            )
            user.save()

        # Do not overwrite an existing membership's role.
        membership, created = Membership.objects.get_or_create(
            user=user,
            workspace=invitation.workspace,
            defaults={"role": invitation.role},
        )

        # Mark the invitation accepted only after membership creation.
        invitation.accepted_at = timezone.now()
        invitation.save(update_fields=["accepted_at"])

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": "Invitation accepted successfully.",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                },
                "workspace": invitation.workspace.slug,
                "role": membership.role,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
            },
            status=status.HTTP_200_OK,
        )


class WorkspaceMembersView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsWorkspaceMember,
        RolePermission,
    ]

    def get(self, request):
        memberships = (
            Membership.objects
            .filter(workspace=request.workspace)
            .select_related("user")
            .order_by("id")
        )

        members = [
            {
                "id": membership.id,
                "user_id": membership.user_id,
                "username": membership.user.username,
                "email": membership.user.email,
                "role": membership.role,
            }
            for membership in memberships
        ]

        return Response(
            {"members": members},
            status=status.HTTP_200_OK,
        )


class WorkspaceMemberDetailView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsWorkspaceMember,
        RolePermission,
    ]
    admin_only_write = True

    def patch(self, request, membership_id):
        serializer = MemberRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_role = serializer.validated_data["role"]

        with transaction.atomic():
            membership = (
                Membership.objects
                .select_for_update()
                .filter(
                    id=membership_id,
                    workspace=request.workspace,
                )
                .first()
            )

            if membership is None:
                return Response(
                    {"detail": "Workspace member not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if (
                membership.role == Membership.ADMIN
                and new_role != Membership.ADMIN
            ):
                admin_count = Membership.objects.filter(
                    workspace=request.workspace,
                    role=Membership.ADMIN,
                ).count()

                if admin_count <= 1:
                    return Response(
                        {
                            "detail": (
                                "Cannot demote the last workspace admin."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            old_role = membership.role

            membership.role = new_role
            membership.save(update_fields=["role"])

            # Record the role change in the audit log.
            if old_role != new_role:
                AuditLog.objects.create(
                    workspace=request.workspace,
                    actor=request.user,
                    action="update",
                    object_type="tenancy.Membership",
                    object_id=str(membership.id),
                    changes={
                        "role": {
                            "before": old_role,
                            "after": new_role,
                        }
                    },
                )

        return Response(
            {
                "message": "Member role updated successfully.",
                "member": {
                    "id": membership.id,
                    "user_id": membership.user_id,
                    "username": membership.user.username,
                    "email": membership.user.email,
                    "role": membership.role,
                },
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, membership_id):
        with transaction.atomic():
            membership = (
                Membership.objects
                .select_for_update()
                .filter(
                    id=membership_id,
                    workspace=request.workspace,
                )
                .select_related("user")
                .first()
            )

            if membership is None:
                return Response(
                    {"detail": "Workspace member not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if membership.role == Membership.ADMIN:
                admin_count = Membership.objects.filter(
                    workspace=request.workspace,
                    role=Membership.ADMIN,
                ).count()

                if admin_count <= 1:
                    return Response(
                        {
                            "detail": (
                                "Cannot remove the last workspace admin."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Record the member before deleting the membership.
            AuditLog.objects.create(
                workspace=request.workspace,
                actor=request.user,
                action="delete",
                object_type="tenancy.Membership",
                object_id=str(membership.id),
                changes={
                    "user_id": membership.user_id,
                    "username": membership.user.username,
                    "email": membership.user.email,
                    "role": membership.role,
                },
            )

            membership.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
