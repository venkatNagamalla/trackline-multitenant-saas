
from pathlib import Path

from rest_framework import serializers

from .models import Attachment, Issue


MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024  # 5 MB


class AttachmentSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)

    class Meta:
        model = Attachment
        fields = [
            "id",
            "issue",
            "file",
            "original_filename",
            "size",
            "uploaded_by",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "original_filename",
            "size",
            "uploaded_by",
            "created_at",
        ]

    def validate_file(self, uploaded_file):
        if uploaded_file.size > MAX_ATTACHMENT_SIZE:
            raise serializers.ValidationError(
                "File size must not exceed 5 MB."
            )

        allowed_extensions = Attachment.ALLOWED_EXTENSIONS
        extension = Path(uploaded_file.name).suffix.lower().lstrip(".")

        if extension not in allowed_extensions:
            raise serializers.ValidationError(
                "This file extension is not allowed."
            )

        return uploaded_file

    def validate_issue(self, issue):
        request = self.context.get("request")

        if request and hasattr(request, "workspace"):
            if issue.workspace_id != request.workspace.id:
                raise serializers.ValidationError(
                    "The issue does not belong to the selected workspace."
                )

        return issue

    def create(self, validated_data):
        uploaded_file = validated_data["file"]

        validated_data["original_filename"] = Path(
            uploaded_file.name
        ).name
        validated_data["size"] = uploaded_file.size

        return super().create(validated_data)
