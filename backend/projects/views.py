from django.shortcuts import render

# Create your views here.


from rest_framework import serializers

from .models import Project
from tenancy.mixins import TenantScopedViewSet


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



class ProjectListCreateView(TenantScopedViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return super().get_queryset().order_by("-created_at")


    def perform_create(self, serializer):
        serializer.save(workspace=self.request.workspace)
