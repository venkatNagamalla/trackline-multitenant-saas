from django.db import transaction
from django.db.models import Count

from audit.models import AuditLog

from tenancy.models import User
from tenancy.mixins import TenantPKField, TenantScopedViewSet

from rest_framework import serializers, status as http_status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .permissions import IsCommentAuthorOrWorkspaceAdmin

from tenancy.permissions import IsWorkspaceMember, RolePermission

from django_filters.rest_framework import DjangoFilterBackend

from .models import Project, Board, WorkflowStatus, Issue, Sprint, Comment

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
        permission_classes = [
            IsAuthenticated,
            IsWorkspaceMember,
            RolePermission,
        ]

        return [permission() for permission in permission_classes]

    def get_queryset(self):
        return super().get_queryset().order_by("-created_at", "-id")

    def perform_destroy(self, instance):
        if self.request.membership.role != "admin":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                "Only workspace admins can delete projects."
            )

        # Write the audit log before deleting the project.
        super().perform_destroy(instance)

    @transaction.atomic
    def perform_create(self, serializer):
        workspace = self.request.workspace

        # Save the project and create its audit record.
        super().perform_create(serializer)
        project = serializer.instance

        # Create the default board.
        board = Board.objects.create(
            workspace=workspace,
            project=project,
            name="Main Board",
        )

        # Create the default workflow statuses.
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
    queryset = WorkflowStatus.objects.all()
    serializer_class = WorkflowStatusSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["board"]
    search_fields = ["name"]

    def perform_create(self, serializer):
        serializer.save(workspace=self.request.workspace)


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
        project = attrs.get(
            "project",
            self.instance.project if self.instance else None,
        )
        board = attrs.get(
            "board",
            self.instance.board if self.instance else None,
        )
        status = attrs.get(
            "status",
            self.instance.status if self.instance else None,
        )
        sprint = attrs.get(
            "sprint",
            self.instance.sprint if self.instance else None,
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

        if status and status.workspace_id != workspace.id:
            raise serializers.ValidationError({
                "status": "Status must belong to the active workspace."
            })

        if project and board and board.project_id != project.id:
            raise serializers.ValidationError({
                "board": "Board must belong to the selected project."
            })

        if board and status and status.board_id != board.id:
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
            self.instance.assignee if self.instance else None,
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
        project = attrs.get(
            "project",
            self.instance.project if self.instance else None,
        )
        start = attrs.get(
            "start",
            self.instance.start if self.instance else None,
        )
        end = attrs.get(
            "end",
            self.instance.end if self.instance else None,
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

        # Lock the project's existing sprint rows while checking state.
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

        return Response({
            "detail": "Sprint completed successfully.",
            "sprint_id": sprint.id,
            "returned_to_backlog": returned_to_backlog,
        }, status=http_status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="report")
    def report(self, request, pk=None):
        sprint = self.get_object()
        issues = Issue.objects.filter(sprint=sprint)

        total = issues.count()
        done = issues.filter(status__is_done=True).count()

        status_counts = {
            item["status__name"]: item["count"]
            for item in issues.values("status__name").annotate(
                count=Count("id")
            ).order_by("status__name")
        }

        return Response({
            "sprint_id": sprint.id,
            "sprint_name": sprint.name,
            "state": sprint.state,
            "total_issues": total,
            "done_issues": done,
            "completion_percentage": round(done * 100 / total, 2) if total else 0,
            "issues_by_status": status_counts,
        }, status=http_status.HTTP_200_OK)


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
        serializer.save(
            workspace=self.request.workspace,
            reporter=self.request.user,
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

        if new_status.board_id != issue.board_id:
            return Response(
                {
                    "status": (
                        "The destination status must belong "
                        "to the issue's board."
                    )
                },
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        # Capture the previous values before updating the issue.
        old_status = issue.status
        old_rank = issue.rank

        # Update the issue's status and rank.
        issue.status = new_status
        issue.rank = new_rank
        issue.save(update_fields=["status", "rank"])

        # Record the move in the audit log.
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
        print("COMMENT ACTION:", self.action)

        if self.action in ["update", "partial_update", "destroy"]:
            permission_classes = [
                IsAuthenticated,
                IsWorkspaceMember,
                IsCommentAuthorOrWorkspaceAdmin,
            ]
        else:
            permission_classes = [
                IsAuthenticated,
                IsWorkspaceMember,
            ]

        return [permission() for permission in permission_classes]

    def perform_create(self, serializer):
        serializer.save(
            workspace=self.request.workspace,
            author=self.request.user,
        )
