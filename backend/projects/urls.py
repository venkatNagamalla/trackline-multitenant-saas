
from django.urls import path

from .views import (
    ProjectListCreateView,
    BoardViewSet,
    WorkflowStatusViewSet,
    IssueViewSet,
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


urlpatterns = [
    path("", project_list_create, name="project-list-create"),
    path("<int:pk>/", project_detail, name="project-detail"),

    path("boards/", board_list_create, name="board-list-create"),
    path("boards/<int:pk>/", board_detail, name="board-detail"),

    path("statuses/", status_list_create, name="status-list-create"),
    path("statuses/<int:pk>/", status_detail, name="status-detail"),

    path("issues/", issue_list_create, name="issue-list-create"),
    path("issues/<int:pk>/", issue_detail, name="issue-detail"),
]
