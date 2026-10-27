from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(
        source="actor.email",
        read_only=True,
        default=None,
    )

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "workspace",
            "actor",
            "actor_email",
            "action",
            "object_type",
            "object_id",
            "changes",
            "created_at",
        ]
        read_only_fields = fields