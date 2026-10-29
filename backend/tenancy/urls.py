
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    SignupView,
    LoginView,
    MeView,
    InvitationCreateView,
    InvitationAcceptView,
    WorkspaceMembersView,
    WorkspaceMemberDetailView,
)

urlpatterns = [
    path("signup/", SignupView.as_view(), name="signup"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),

    path(
        "invitations/",
        InvitationCreateView.as_view(),
        name="invitation-create",
    ),
    path(
        "invitations/<uuid:token>/accept/",
        InvitationAcceptView.as_view(),
        name="invitation-accept",
    ),
    path(
    "workspace/members/",
    WorkspaceMembersView.as_view(),
    name="workspace-members",
),
path(
    "workspace/members/<int:membership_id>/",
    WorkspaceMemberDetailView.as_view(),
    name="workspace-member-detail",
),
]
