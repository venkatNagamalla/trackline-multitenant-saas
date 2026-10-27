
from django.db import models


class Project(models.Model):
    workspace = models.ForeignKey(
        "tenancy.Workspace",
        on_delete=models.CASCADE,
        related_name="projects",
    )
    name = models.CharField(max_length=150)
    key = models.CharField(max_length=10, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "key"],
                name="unique_project_key_per_workspace",
            ),
        ]

    def __str__(self):
        return self.name


class Sprint(models.Model):
    STATE_CHOICES = [
        ("planned", "Planned"),
        ("active", "Active"),
        ("closed", "Closed"),
    ]

    workspace = models.ForeignKey(
        "tenancy.Workspace",
        on_delete=models.CASCADE,
        related_name="sprints",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="sprints",
    )
    name = models.CharField(max_length=150)
    start = models.DateField()
    end = models.DateField()
    state = models.CharField(
        max_length=10,
        choices=STATE_CHOICES,
        default="planned",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start", "id"]

    def __str__(self):
        return f"{self.project.name} - {self.name}"


class Board(models.Model):
    workspace = models.ForeignKey(
        "tenancy.Workspace",
        on_delete=models.CASCADE,
        related_name="boards",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="boards",
    )
    name = models.CharField(max_length=100)

    class Meta:
        ordering = ["name", "id"]

    def __str__(self):
        return self.name


class WorkflowStatus(models.Model):
    workspace = models.ForeignKey(
        "tenancy.Workspace",
        on_delete=models.CASCADE,
        related_name="workflow_statuses",
    )
    board = models.ForeignKey(
        Board,
        on_delete=models.CASCADE,
        related_name="statuses",
    )
    name = models.CharField(max_length=50)
    order = models.PositiveIntegerField(default=0)
    is_done = models.BooleanField(default=False)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.name


class WorkflowTransition(models.Model):
    board = models.ForeignKey(
        Board,
        on_delete=models.CASCADE,
        related_name="workflow_transitions",
    )
    from_status = models.ForeignKey(
        WorkflowStatus,
        on_delete=models.CASCADE,
        related_name="outgoing_transitions",
    )
    to_status = models.ForeignKey(
        WorkflowStatus,
        on_delete=models.CASCADE,
        related_name="incoming_transitions",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["board", "from_status", "to_status"],
                name="unique_workflow_transition",
            ),
        ]

    def __str__(self):
        return f"{self.from_status.name} -> {self.to_status.name}"


class Issue(models.Model):
    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("urgent", "Urgent"),
    ]

    workspace = models.ForeignKey(
        "tenancy.Workspace",
        on_delete=models.CASCADE,
        related_name="issues",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="issues",
    )
    sprint = models.ForeignKey(
        Sprint,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="issues",
    )
    board = models.ForeignKey(
        Board,
        on_delete=models.CASCADE,
        related_name="issues",
    )
    status = models.ForeignKey(
        WorkflowStatus,
        on_delete=models.PROTECT,
        related_name="issues",
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default="medium",
    )
    assignee = models.ForeignKey(
        "tenancy.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_issues",
    )
    reporter = models.ForeignKey(
        "tenancy.User",
        on_delete=models.PROTECT,
        related_name="reported_issues",
    )
    rank = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["rank", "id"]
        indexes = [
            models.Index(
                fields=["workspace", "project"],
                name="issue_ws_project_idx",
            ),
            models.Index(
                fields=["workspace", "status"],
                name="issue_ws_status_idx",
            ),
        ]

    def __str__(self):
        return self.title


class Comment(models.Model):
    workspace = models.ForeignKey(
        "tenancy.Workspace",
        on_delete=models.CASCADE,
        related_name="comments",
    )
    issue = models.ForeignKey(
        Issue,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        "tenancy.User",
        on_delete=models.CASCADE,
        related_name="issue_comments",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Comment by {self.author} on Issue {self.issue_id}"
