
# Register your models here.
from django.contrib import admin
from .models import Subscription


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        "workspace",
        "stripe_subscription_id",
        "status",
        "price_id",
        "current_period_end",
        "cancel_at_period_end",
    )

    list_filter = ("status", "cancel_at_period_end")
    search_fields = (
        "workspace__name",
        "stripe_subscription_id",
    )