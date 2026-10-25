
from rest_framework.permissions import BasePermission

from .models import Membership


class IsWorkspaceMember(BasePermission):

    def has_permission(self, request, view):
        slug = request.headers.get("X-Workspace")

        if not slug or not request.user.is_authenticated:
            return False

        membership = (
            Membership.objects.select_related("workspace")
            .filter(
                user=request.user,
                workspace__slug=slug
            )
            .first()
        )

        if membership is None:
            return False

        request.workspace = membership.workspace
        request.membership = membership

        return True
