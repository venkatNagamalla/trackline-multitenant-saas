
from django.urls import path
from .views import ProjectListCreateView

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

urlpatterns = [
    path("", project_list_create, name="project-list-create"),
    path("<int:pk>/", project_detail, name="project-detail"),
]
