from rest_framework.permissions import BasePermission, SAFE_METHODS




class IsCommentAuthorOrWorkspaceAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        print(
            "COMMENT PERMISSION CHECK:",
            "user_id =", request.user.id,
            "author_id =", obj.author_id,
            "action =", getattr(view, "action", None),
        )

        if request.method in SAFE_METHODS:
            print("COMMENT PERMISSION RESULT: READ ALLOWED")
            return True

        if obj.author_id == request.user.id:
            print("COMMENT PERMISSION RESULT: AUTHOR ALLOWED")
            return True

        membership = getattr(request, "membership", None)

        allowed = (
            membership is not None
            and membership.role == "admin"
            and membership.workspace_id == obj.workspace_id
        )

        print(
            "COMMENT PERMISSION RESULT:",
            allowed,
            "membership_role =",
            getattr(membership, "role", None),
        )

        return allowed

    """
    Read access for workspace members.
    Edit/delete access for the comment author or workspace admin.
    """

    def has_object_permission(self, request, view, obj):
        # Allow read-only methods for workspace members.
        if request.method in SAFE_METHODS:
            return True

        # Allow the comment author.
        if obj.author_id == request.user.id:
            return True

        # Allow workspace admins.
        membership = getattr(request, "membership", None)

        return (
            membership is not None
            and membership.role == "admin"
            and membership.workspace_id == obj.workspace_id
        )