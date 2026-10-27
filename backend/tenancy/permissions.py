
from rest_framework.permissions import BasePermission, SAFE_METHODS

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


class RolePermission(BasePermission):
    """
    Centralized role-based permissions for workspace actions.

    Read access: all workspace members.
    Writes: members and admins.
    Admin-only actions: controlled by view flags.
    """

    def has_permission(self, request, view):
        membership = getattr(request, "membership", None)

        if membership is None:
            return False

        role = membership.role

        # All workspace roles can read.
        if request.method in SAFE_METHODS:
            return True

        # Viewers cannot perform write operations.
        if role == "viewer":
            return False

        # Some actions are restricted to workspace admins.
        if getattr(view, "admin_only_write", False):
            return role == "admin"

        return role in ("admin", "member")
