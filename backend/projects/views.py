
from django.db import transaction
from tenancy.models import User
from rest_framework import serializers
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import Project, Board, WorkflowStatus, Issue
from tenancy.mixins import TenantPKField, TenantScopedViewSet


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

    def get_queryset(self):
        return super().get_queryset().order_by("-created_at", "-id")

    @transaction.atomic
    def perform_create(self, serializer):
        workspace = self.request.workspace

        project = serializer.save(workspace=workspace)

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

        assignee = attrs.get("assignee")
        if assignee and not assignee.memberships.filter(
            workspace=workspace
        ).exists():
            raise serializers.ValidationError({
                "assignee": "Assignee must be a member of this workspace."
            })

        return attrs


# -------------------------
# Issue ViewSet
# -------------------------

class IssueViewSet(TenantScopedViewSet):
    queryset = Issue.objects.select_related(
        "project", "board", "status", "assignee", "reporter"
    )
    serializer_class = IssueSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = [
        "project",
        "board",
        "status",
        "assignee",
        "priority",
    ]
    search_fields = ["title", "description"]

    def perform_create(self, serializer):
        serializer.save(
            workspace=self.request.workspace,
            reporter=self.request.user,
        )
