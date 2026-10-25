from django.shortcuts import render

# Create your views here.

from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated

from .models import Project
from tenancy.permissions import IsWorkspaceMember


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ProjectListCreateView(generics.ListCreateAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        return Project.objects.filter(
            workspace=self.request.workspace
        ).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(workspace=self.request.workspace)
