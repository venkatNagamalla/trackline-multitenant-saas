
from django.urls import path

from .views import (
    ProjectListCreateView,
    BoardViewSet,
    WorkflowStatusViewSet,
    IssueViewSet,
    SprintViewSet,
    CommentViewSet,
)

project_list_create = ProjectListCreateView.as_view({
    "get": "list",
    "post": "create",
})

project_detail = ProjectListCreateView.as_view({
    "get": "retrieve",
    "put": "update",
    "patch": "partial_update",
    "delete": "destroy",
})

board_list_create = BoardViewSet.as_view({
    "get": "list",
    "post": "create",
})

board_detail = BoardViewSet.as_view({
    "get": "retrieve",
    "put": "update",
    "patch": "partial_update",
    "delete": "destroy",
})

status_list_create = WorkflowStatusViewSet.as_view({
    "get": "list",
    "post": "create",
})

status_detail = WorkflowStatusViewSet.as_view({
    "get": "retrieve",
    "put": "update",
    "patch": "partial_update",
    "delete": "destroy",
})

issue_list_create = IssueViewSet.as_view({
    "get": "list",
    "post": "create",
})

issue_detail = IssueViewSet.as_view({
    "get": "retrieve",
    "put": "update",
    "patch": "partial_update",
    "delete": "destroy",
})

issue_move = IssueViewSet.as_view({
    "post": "move",
})

sprint_list_create = SprintViewSet.as_view({
    "get": "list",
    "post": "create",
})

sprint_detail = SprintViewSet.as_view({
    "get": "retrieve",
    "put": "update",
    "patch": "partial_update",
    "delete": "destroy",
})

sprint_start = SprintViewSet.as_view({"post": "start"})
sprint_complete = SprintViewSet.as_view({"post": "complete"})
sprint_report = SprintViewSet.as_view({"get": "report"})

comment_list_create = CommentViewSet.as_view({
    "get": "list",
    "post": "create",
})

comment_detail = CommentViewSet.as_view({
    "get": "retrieve",
    "put": "update",
    "patch": "partial_update",
    "delete": "destroy",
})

urlpatterns = [
    path("", project_list_create, name="project-list-create"),
    path("<int:pk>/", project_detail, name="project-detail"),

    path("boards/", board_list_create, name="board-list-create"),
    path("boards/<int:pk>/", board_detail, name="board-detail"),

    path("statuses/", status_list_create, name="status-list-create"),
    path("statuses/<int:pk>/", status_detail, name="status-detail"),

    path("issues/", issue_list_create, name="issue-list-create"),
    path("issues/<int:pk>/", issue_detail, name="issue-detail"),

    path(
    "issues/<int:pk>/move/",
    issue_move,
    name="issue-move",
),
path("sprints/", sprint_list_create, name="sprint-list-create"),
path("sprints/<int:pk>/", sprint_detail, name="sprint-detail"),
path("sprints/<int:pk>/start/", sprint_start, name="sprint-start"),
path("sprints/<int:pk>/complete/", sprint_complete, name="sprint-complete"),
path("sprints/<int:pk>/report/", sprint_report, name="sprint-report"),
path(
    "issues/<int:issue_pk>/comments/",
    comment_list_create,
    name="issue-comment-list-create",
),
path(
    "comments/<int:pk>/",
    comment_detail,
    name="comment-detail",
),
]
