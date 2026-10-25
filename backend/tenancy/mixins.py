
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated

from .permissions import IsWorkspaceMember


class TenantPKField(serializers.PrimaryKeyRelatedField):
    """Foreign keys from the client may only point at the caller's workspace."""

    def get_queryset(self):
        return super().get_queryset().filter(
            workspace=self.context["request"].workspace
        )


class TenantScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        return super().get_queryset().filter(
            workspace=self.request.workspace
        )

    def perform_create(self, serializer):
        # The workspace always comes from the request, never from client data.
        serializer.save(workspace=self.request.workspace)
