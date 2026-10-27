
from django.forms.models import model_to_dict
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated

from audit.models import AuditLog
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
        workspace = self.request.workspace
        instance = serializer.save(workspace=workspace)

        self._write_audit_log(
            action="create",
            instance=instance,
            changes={"after": self._serialize_instance(instance)},
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        before = self._serialize_instance(instance)

        instance = serializer.save()

        self._write_audit_log(
            action="update",
            instance=instance,
            changes={
                "before": before,
                "after": self._serialize_instance(instance),
            },
        )
        
    def perform_destroy(self, instance):
        before = self._serialize_instance(instance)

        self._write_audit_log(
            action="delete",
            instance=instance,
            changes={"before": before},
        )

        instance.delete()

    def _serialize_instance(self, instance):
        """Return JSON-compatible model fields for the audit record."""
        data = model_to_dict(instance)

        return {
            key: str(value) if value is not None else None
            for key, value in data.items()
        }

    def _write_audit_log(self, action, instance, changes):
        AuditLog.objects.create(
            workspace=self.request.workspace,
            actor=self.request.user,
            action=action,
            object_type=instance._meta.label,
            object_id=str(instance.pk),
            changes=changes,
        )
