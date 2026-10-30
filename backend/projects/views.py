from rest_framework import viewsets
from django.db import transaction
from django.db.models import Count
from django.db.models.deletion import ProtectedError

from rest_framework import serializers, status as http_status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend

from audit.models import AuditLog
from tenancy.models import User
from tenancy.mixins import TenantPKField, TenantScopedViewSet
from tenancy.permissions import IsWorkspaceMember, RolePermission

from django.http import FileResponse
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action

from billing.limits import check_limit

from notifications.services import queue_webhook_event

from .models import (
    Project,
    Board,
    WorkflowStatus,
    WorkflowTransition,
    Issue,
    Sprint,
    Comment,
     Attachment,
)

from .serializers import AttachmentSerializer
from .permissions import IsCommentAuthorOrWorkspaceAdmin


# -------------------------
# Project Serializer
# -------------------------

class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "key",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_key(self, value):
        value = value.strip().upper()

        if not value:
            raise serializers.ValidationError(
                "Project key cannot be empty."
            )

        workspace = self.context["request"].workspace

        existing = Project.objects.filter(
            workspace=workspace,
            key=value,
        )

        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)

        if existing.exists():
            raise serializers.ValidationError(
                "This project key is already used in this workspace."
            )

        return value


# -------------------------
# Project ViewSet
# -------------------------

class ProjectListCreateView(TenantScopedViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer

    def get_permissions(self):
        return [
            IsAuthenticated(),
            IsWorkspaceMember(),
            RolePermission(),
        ]

    def get_queryset(self):
        return super().get_queryset().order_by("-created_at", "-id")

    def perform_destroy(self, instance):
        if self.request.membership.role != "admin":
            raise PermissionDenied(
                "Only workspace admins can delete projects."
            )

        super().perform_destroy(instance)

    @transaction.atomic
    def perform_create(self, serializer):
        workspace = self.request.workspace

        # Check the workspace project limit
        check_limit(workspace, "projects")

        super().perform_create(serializer)
        project = serializer.instance

        board = Board.objects.create(
            workspace=workspace,
            project=project,
            name="Main Board",
        )

        WorkflowStatus.objects.bulk_create([
            WorkflowStatus(
                workspace=workspace,
                board=board,
                name="To Do",
                order=1,
                is_done=False,
            ),
            WorkflowStatus(
                workspace=workspace,
                board=board,
                name="In Progress",
                order=2,
                is_done=False,
            ),
            WorkflowStatus(
                workspace=workspace,
                board=board,
                name="Done",
                order=3,
                is_done=True,
            ),
        ])


# -------------------------
# Board Serializer
# -------------------------

class BoardSerializer(serializers.ModelSerializer):
    project = TenantPKField(queryset=Project.objects.all())

    class Meta:
        model = Board
        fields = ["id", "project", "name"]
        read_only_fields = ["id"]

    def validate_project(self, project):
        if project.workspace_id != self.context["request"].workspace.id:
            raise serializers.ValidationError(
                "Project must belong to the active workspace."
            )
        return project


# -------------------------
# Board ViewSet
# -------------------------

class BoardViewSet(TenantScopedViewSet):
    queryset = Board.objects.all()
    serializer_class = BoardSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["project"]
    search_fields = ["name"]

    def perform_create(self, serializer):
        serializer.save(workspace=self.request.workspace)


# -------------------------
# Workflow Status Serializer
# -------------------------

class WorkflowStatusSerializer(serializers.ModelSerializer):
    board = TenantPKField(queryset=Board.objects.all())

    class Meta:
        model = WorkflowStatus
        fields = ["id", "board", "name", "order", "is_done"]
        read_only_fields = ["id"]

    def validate_board(self, board):
        if board.workspace_id != self.context["request"].workspace.id:
            raise serializers.ValidationError(
                "Board must belong to the active workspace."
            )
        return board


# -------------------------
# Workflow Status ViewSet
# -------------------------

class WorkflowStatusViewSet(TenantScopedViewSet):
    queryset = WorkflowStatus.objects.select_related(
        "board",
        "workspace",
    )
    serializer_class = WorkflowStatusSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["board"]
    search_fields = ["name"]

    def get_permissions(self):
        return [
            IsAuthenticated(),
            IsWorkspaceMember(),
            RolePermission(),
        ]

    def get_queryset(self):
        return super().get_queryset().filter(
            workspace=self.request.workspace,
            board__workspace=self.request.workspace,
        )

    def _require_admin(self):
        if self.request.membership.role != "admin":
            raise PermissionDenied(
                "Only workspace admins can manage workflow statuses."
            )

    def perform_create(self, serializer):
        self._require_admin()
        serializer.save(workspace=self.request.workspace)

    def perform_update(self, serializer):
        self._require_admin()
        serializer.save()

    def perform_destroy(self, instance):
        self._require_admin()

        try:
            with transaction.atomic():
                instance.delete()
        except ProtectedError:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({
                "detail": (
                    "Cannot delete this workflow status because it still "
                    "has issues assigned to it. Move those issues to "
                    "another status first."
                )
            })


# -------------------------
# Workflow Transition Serializer
# -------------------------

class WorkflowTransitionSerializer(serializers.ModelSerializer):
    board = TenantPKField(queryset=Board.objects.all())
    from_status = TenantPKField(queryset=WorkflowStatus.objects.all())
    to_status = TenantPKField(queryset=WorkflowStatus.objects.all())

    class Meta:
        model = WorkflowTransition
        fields = ["id", "board", "from_status", "to_status"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        request = self.context["request"]
        instance = self.instance

        board = attrs.get(
            "board",
            instance.board if instance else None,
        )
        from_status = attrs.get(
            "from_status",
            instance.from_status if instance else None,
        )
        to_status = attrs.get(
            "to_status",
            instance.to_status if instance else None,
        )

        if board is None or from_status is None or to_status is None:
            raise serializers.ValidationError(
                "Board, source status, and destination status are required."
            )

        if board.workspace_id != request.workspace.id:
            raise serializers.ValidationError({
                "board": "Board must belong to the active workspace."
            })

        if from_status.workspace_id != request.workspace.id:
            raise serializers.ValidationError({
                "from_status": (
                    "Source status must belong to the active workspace."
                )
            })

        if to_status.workspace_id != request.workspace.id:
            raise serializers.ValidationError({
                "to_status": (
                    "Destination status must belong to the active workspace."
                )
            })

        if from_status.board_id != board.id:
            raise serializers.ValidationError({
                "from_status": (
                    "Source status must belong to the selected board."
                )
            })

        if to_status.board_id != board.id:
            raise serializers.ValidationError({
                "to_status": (
                    "Destination status must belong to the selected board."
                )
            })

        if from_status.id == to_status.id:
            raise serializers.ValidationError({
                "to_status": "A status cannot transition to itself."
            })

        return attrs


# -------------------------
# Workflow Transition ViewSet
# -------------------------

class WorkflowTransitionViewSet(viewsets.ModelViewSet):
    queryset = WorkflowTransition.objects.select_related(
        "board",
        "from_status",
        "to_status",
    )
    serializer_class = WorkflowTransitionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["board"]

    def get_permissions(self):
        return [
            IsAuthenticated(),
            IsWorkspaceMember(),
            RolePermission(),
        ]

    def get_queryset(self):
        return super().get_queryset().filter(
            board__workspace=self.request.workspace,
            from_status__workspace=self.request.workspace,
            to_status__workspace=self.request.workspace,
        )

    def _require_admin(self):
        if self.request.membership.role != "admin":
            raise PermissionDenied(
                "Only workspace admins can manage workflow transitions."
            )

    def perform_create(self, serializer):
        self._require_admin()
        serializer.save()

    def perform_update(self, serializer):
        self._require_admin()
        serializer.save()

    def perform_destroy(self, instance):
        self._require_admin()
        super().perform_destroy(instance)


# -------------------------
# Issue Serializer
# -------------------------

class IssueSerializer(serializers.ModelSerializer):
    project = TenantPKField(queryset=Project.objects.all())
    board = TenantPKField(queryset=Board.objects.all())
    status = TenantPKField(queryset=WorkflowStatus.objects.all())
    sprint = TenantPKField(
        queryset=Sprint.objects.all(),
        required=False,
        allow_null=True,
    )

    assignee = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
    )
    reporter = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Issue
        fields = [
            "id",
            "project",
            "board",
            "status",
            "sprint",
            "title",
            "description",
            "priority",
            "assignee",
            "reporter",
            "rank",
            "created_at",
        ]
        read_only_fields = ["id", "reporter", "created_at"]

    def validate(self, attrs):
        instance = self.instance

        project = attrs.get(
            "project",
            instance.project if instance else None,
        )
        board = attrs.get(
            "board",
            instance.board if instance else None,
        )
        status_obj = attrs.get(
            "status",
            instance.status if instance else None,
        )
        sprint = attrs.get(
            "sprint",
            instance.sprint if instance else None,
        )
        workspace = self.context["request"].workspace

        if project and project.workspace_id != workspace.id:
            raise serializers.ValidationError({
                "project": "Project must belong to the active workspace."
            })

        if board and board.workspace_id != workspace.id:
            raise serializers.ValidationError({
                "board": "Board must belong to the active workspace."
            })

        if status_obj and status_obj.workspace_id != workspace.id:
            raise serializers.ValidationError({
                "status": "Status must belong to the active workspace."
            })

        if project and board and board.project_id != project.id:
            raise serializers.ValidationError({
                "board": "Board must belong to the selected project."
            })

        if board and status_obj and status_obj.board_id != board.id:
            raise serializers.ValidationError({
                "status": "Status must belong to the selected board."
            })

        if sprint and sprint.workspace_id != workspace.id:
            raise serializers.ValidationError({
                "sprint": "Sprint must belong to the active workspace."
            })

        if sprint and project and sprint.project_id != project.id:
            raise serializers.ValidationError({
                "sprint": "Sprint must belong to the selected project."
            })

        assignee = attrs.get(
            "assignee",
            instance.assignee if instance else None,
        )
        if assignee and not assignee.memberships.filter(
            workspace=workspace
        ).exists():
            raise serializers.ValidationError({
                "assignee": "Assignee must be a member of this workspace."
            })

        return attrs


# -------------------------
# Issue Move Serializer
# -------------------------

class IssueMoveSerializer(serializers.Serializer):
    status = TenantPKField(queryset=WorkflowStatus.objects.all())
    rank = serializers.FloatField()


# -------------------------
# Sprint Serializer
# -------------------------

class SprintSerializer(serializers.ModelSerializer):
    project = TenantPKField(queryset=Project.objects.all())

    class Meta:
        model = Sprint
        fields = [
            "id",
            "project",
            "name",
            "start",
            "end",
            "state",
            "created_at",
        ]
        read_only_fields = ["id", "state", "created_at"]

    def validate(self, attrs):
        instance = self.instance

        project = attrs.get(
            "project",
            instance.project if instance else None,
        )
        start = attrs.get(
            "start",
            instance.start if instance else None,
        )
        end = attrs.get(
            "end",
            instance.end if instance else None,
        )
        workspace = self.context["request"].workspace

        if project and project.workspace_id != workspace.id:
            raise serializers.ValidationError({
                "project": "Project must belong to the active workspace."
            })

        if start and end and end < start:
            raise serializers.ValidationError({
                "end": "End date must be on or after the start date."
            })

        return attrs


# -------------------------
# Comment Serializer
# -------------------------

class CommentSerializer(serializers.ModelSerializer):
    author = serializers.ReadOnlyField(source="author.id")

    class Meta:
        model = Comment
        fields = [
            "id",
            "issue",
            "author",
            "body",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "author",
            "created_at",
            "updated_at",
        ]


# -------------------------
# Sprint ViewSet
# -------------------------

class SprintViewSet(TenantScopedViewSet):
    queryset = Sprint.objects.select_related("project")
    serializer_class = SprintSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["project", "state"]
    search_fields = ["name"]

    def perform_create(self, serializer):
        project = serializer.validated_data["project"]

        if project.workspace_id != self.request.workspace.id:
            raise serializers.ValidationError(
                "Project must belong to the active workspace."
            )

        serializer.save(workspace=self.request.workspace)

    @action(detail=True, methods=["post"], url_path="start")
    @transaction.atomic
    def start(self, request, pk=None):
        sprint = self.get_object()

        list(
            Sprint.objects.select_for_update()
            .filter(project=sprint.project)
            .values_list("id", flat=True)
        )

        if sprint.state == "closed":
            return Response(
                {"detail": "A closed sprint cannot be started."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        another_active = Sprint.objects.filter(
            project=sprint.project,
            state="active",
        ).exclude(pk=sprint.pk).exists()

        if another_active:
            return Response(
                {"detail": "This project already has an active sprint."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        sprint.state = "active"
        sprint.save(update_fields=["state"])

        return Response(
            SprintSerializer(
                sprint,
                context=self.get_serializer_context(),
            ).data,
            status=http_status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="complete")
    @transaction.atomic
    def complete(self, request, pk=None):
        sprint = self.get_object()

        if sprint.state == "closed":
            return Response(
                {"detail": "This sprint is already closed."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        unfinished = Issue.objects.filter(
            sprint=sprint,
        ).exclude(status__is_done=True)

        returned_to_backlog = unfinished.update(sprint=None)

        sprint.state = "closed"
        sprint.save(update_fields=["state"])

        return Response(
            {
                "detail": "Sprint completed successfully.",
                "sprint_id": sprint.id,
                "returned_to_backlog": returned_to_backlog,
            },
            status=http_status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="report")
    def report(self, request, pk=None):
        sprint = self.get_object()
        issues = Issue.objects.filter(sprint=sprint)

        total = issues.count()
        done = issues.filter(status__is_done=True).count()

        status_counts = {
            item["status__name"]: item["count"]
            for item in issues.values("status__name")
            .annotate(count=Count("id"))
            .order_by("status__name")
        }

        return Response(
            {
                "sprint_id": sprint.id,
                "sprint_name": sprint.name,
                "state": sprint.state,
                "total_issues": total,
                "done_issues": done,
                "completion_percentage": (
                    round(done * 100 / total, 2) if total else 0
                ),
                "issues_by_status": status_counts,
            },
            status=http_status.HTTP_200_OK,
        )


# -------------------------
# Issue ViewSet
# -------------------------


class IssueViewSet(TenantScopedViewSet):
    queryset = Issue.objects.select_related(
        "project",
        "board",
        "status",
        "sprint",
        "assignee",
        "reporter",
    )
    serializer_class = IssueSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = {
        "project": ["exact"],
        "board": ["exact"],
        "status": ["exact"],
        "priority": ["exact"],
        "assignee": ["exact"],
        "sprint": ["exact", "isnull"],
    }
    search_fields = ["title", "description"]

    def perform_create(self, serializer):
        issue = serializer.save(
            workspace=self.request.workspace,
            reporter=self.request.user,
        )

        queue_webhook_event(
            workspace=self.request.workspace,
            event="issue.created",
            payload={
                "event": "issue.created",
                "issue": {
                    "id": issue.id,
                    "title": issue.title,
                    "description": issue.description,
                    "project_id": issue.project_id,
                    "board_id": issue.board_id,
                    "status_id": issue.status_id,
                    "priority": issue.priority,
                    "assignee_id": issue.assignee_id,
                    "reporter_id": issue.reporter_id,
                    "workspace": self.request.workspace.slug,
                },
            },
        )

    @action(detail=True, methods=["post"], url_path="move")
    @transaction.atomic
    def move(self, request, pk=None):
        issue = self.get_object()

        serializer = IssueMoveSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data["status"]
        new_rank = serializer.validated_data["rank"]

        if new_status.workspace_id != request.workspace.id:
            return Response(
                {"detail": "Destination status must belong to this workspace."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        if new_status.board_id != issue.board_id:
            return Response(
                {
                    "detail": (
                        "The destination status must belong "
                        "to the issue's board."
                    )
                },
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        allowed_transitions = WorkflowTransition.objects.filter(
            board_id=issue.board_id,
            from_status_id=issue.status_id,
        )

        if allowed_transitions.exists():
            transition_allowed = allowed_transitions.filter(
                to_status_id=new_status.id,
            ).exists()

            if not transition_allowed:
                return Response(
                    {
                        "detail": (
                            f"Transition from '{issue.status.name}' "
                            f"to '{new_status.name}' is not allowed."
                        )
                    },
                    status=http_status.HTTP_400_BAD_REQUEST,
                )

        old_status = issue.status
        old_rank = issue.rank

        issue.status = new_status
        issue.rank = new_rank
        issue.save(update_fields=["status", "rank"])

        AuditLog.objects.create(
            workspace=request.workspace,
            actor=request.user,
            action="move",
            object_type=issue._meta.label,
            object_id=str(issue.pk),
            changes={
                "before": {
                    "status_id": old_status.id,
                    "status_name": old_status.name,
                    "rank": old_rank,
                },
                "after": {
                    "status_id": new_status.id,
                    "status_name": new_status.name,
                    "rank": new_rank,
                },
            },
        )

        return Response(
            {
                "id": issue.id,
                "status": issue.status_id,
                "rank": issue.rank,
            },
            status=http_status.HTTP_200_OK,
        )

# -------------------------
# Comment ViewSet
# -------------------------

class CommentViewSet(TenantScopedViewSet):
    serializer_class = CommentSerializer

    def get_serializer(self, *args, **kwargs):
        if self.action == "create":
            kwargs["data"] = kwargs.get("data", {}).copy()
            kwargs["data"]["issue"] = self.kwargs["issue_pk"]

        return super().get_serializer(*args, **kwargs)

    def get_queryset(self):
        return (
            Comment.objects
            .filter(workspace=self.request.workspace)
            .select_related("issue", "author", "workspace")
        )

    def get_permissions(self):
        if self.action in ["update", "partial_update", "destroy"]:
            return [
                IsAuthenticated(),
                IsWorkspaceMember(),
                IsCommentAuthorOrWorkspaceAdmin(),
            ]

        return [
            IsAuthenticated(),
            IsWorkspaceMember(),
        ]

    def perform_create(self, serializer):
        serializer.save(
            workspace=self.request.workspace,
            author=self.request.user,
        )


# -------------------------
# Attachment ViewSet
# -------------------------

class AttachmentViewSet(TenantScopedViewSet):
    serializer_class = AttachmentSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return (
            Attachment.objects
            .filter(
                workspace=self.request.workspace,
                issue__workspace=self.request.workspace,
            )
            .select_related("issue", "uploaded_by", "workspace")
        )

    def get_permissions(self):
        return [
            IsAuthenticated(),
            IsWorkspaceMember(),
        ]

    def perform_create(self, serializer):
        issue = serializer.validated_data["issue"]

        if issue.workspace_id != self.request.workspace.id:
            raise PermissionDenied(
                "Issue must belong to the active workspace."
            )

        serializer.save(
            workspace=self.request.workspace,
            uploaded_by=self.request.user,
        )

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        attachment = self.get_object()

        if not attachment.file:
            return Response(
                {"detail": "Attachment file not found."},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        try:
            attachment.file.open("rb")
            return FileResponse(
                attachment.file,
                as_attachment=True,
                filename=attachment.original_filename,
            )
        except (OSError, ValueError):
            return Response(
                {"detail": "Unable to read attachment file."},
                status=http_status.HTTP_404_NOT_FOUND,
            )
