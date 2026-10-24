from django.contrib.auth.models import AbstractUser
from django.db import models
 
 
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
