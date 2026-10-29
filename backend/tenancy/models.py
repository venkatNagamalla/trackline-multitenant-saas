from django.contrib.auth.models import AbstractUser
from django.db import models

import uuid
from django.utils import timezone 
 
 
class User(AbstractUser):
    email = models.EmailField(unique=True)

class Workspace(models.Model):
    PLANS = [("free", "Free"), ("pro", "Pro")]

    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    plan = models.CharField(max_length=20, choices=PLANS, default="free")
    stripe_customer_id = models.CharField(max_length=64, blank=True)

class Membership(models.Model):
    ADMIN, MEMBER, VIEWER = "admin", "member", "viewer"

    ROLES = [(ADMIN, "Admin"), (MEMBER, "Member"), (VIEWER, "Viewer")]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=10, choices=ROLES, default=MEMBER)

    class Meta:
        unique_together = ("user", "workspace")

class Invitation(models.Model):
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="invitations",
    )

    email = models.EmailField()

    role = models.CharField(
        max_length=10,
        choices=Membership.ROLES,
        default=Membership.MEMBER,
    )

    token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )

    accepted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        default=timezone.now,
        editable=False,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "email"],
                condition=models.Q(accepted_at__isnull=True),
                name="unique_pending_workspace_invitation",
            ),
        ]

    def __str__(self):
        return f"{self.email} - {self.workspace.name}"