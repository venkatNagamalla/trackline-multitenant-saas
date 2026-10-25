
from django.urls import path
from .views import ProjectListCreateView

project_list_create = ProjectListCreateView.as_view({
    "get": "list",
    "post": "create",
})

urlpatterns = [
    path("", project_list_create, name="project-list-create"),
]
