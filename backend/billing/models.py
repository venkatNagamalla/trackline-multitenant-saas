
from django.db import models


class Subscription(models.Model):
    STATUS_CHOICES = [
        ("incomplete", "Incomplete"),
        ("trialing", "Trialing"),
        ("active", "Active"),
        ("past_due", "Past Due"),
        ("canceled", "Canceled"),
        ("unpaid", "Unpaid"),
        ("incomplete_expired", "Incomplete Expired"),
        ("paused", "Paused"),
    ]

    workspace = models.ForeignKey(
        "tenancy.Workspace",
        on_delete=models.CASCADE,
        related_name="subscriptions",
    )

    stripe_subscription_id = models.CharField(
        max_length=100,
        unique=True,
    )

    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default="incomplete",
    )

    price_id = models.CharField(max_length=100, blank=True)

    current_period_end = models.DateTimeField(
        null=True,
        blank=True,
    )

    cancel_at_period_end = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.workspace.name} - {self.status}"
