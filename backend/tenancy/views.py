from django.shortcuts import render

# Create your views here.

from django.db import transaction
from django.utils.text import slugify
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated


from .models import User, Workspace, Membership
from .serializers import SignupSerializer, LoginSerializer


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
