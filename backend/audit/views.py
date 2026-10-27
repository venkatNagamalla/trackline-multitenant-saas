
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination

from tenancy.permissions import IsWorkspaceMember
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogPagination(PageNumberPagination):
    """Return 10 audit logs per page."""
    page_size = 10


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]
    pagination_class = AuditLogPagination

    def get_queryset(self):
        # Only workspace admins can view audit logs.
        if self.request.membership.role != "admin":
            raise PermissionDenied(
                "Only workspace admins can view audit logs."
            )

        # Show audit logs belonging only to the selected workspace.
        queryset = AuditLog.objects.filter(
            workspace=self.request.workspace
        )

        # Filter by action: create, update, or delete.
        action = self.request.query_params.get("action")
        if action:
            queryset = queryset.filter(action=action)

        # Filter by object type, such as projects.Project.
        object_type = self.request.query_params.get("object_type")
        if object_type:
            queryset = queryset.filter(object_type=object_type)

        # Filter by object ID.
        object_id = self.request.query_params.get("object_id")
        if object_id:
            queryset = queryset.filter(object_id=object_id)

        return queryset
