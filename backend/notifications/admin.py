
from django.contrib import admin

from .models import WebhookDelivery, WebhookEndpoint


@admin.register(WebhookEndpoint)
class WebhookEndpointAdmin(admin.ModelAdmin):
    list_display = ("id", "workspace", "url", "active", "created_at")
    list_filter = ("active", "created_at")
    search_fields = ("url", "workspace__name", "workspace__slug")
    readonly_fields = ("secret", "created_at", "updated_at")


@admin.register(WebhookDelivery)
class WebhookDeliveryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "endpoint",
        "event",
        "status",
        "attempts",
        "created_at",
        "last_attempt_at",
    )
    list_filter = ("status", "event", "created_at")
    search_fields = ("event", "endpoint__url", "last_error")
    readonly_fields = (
        "endpoint",
        "event",
        "payload",
        "status",
        "attempts",
        "response_status",
        "response_body",
        "last_error",
        "created_at",
        "last_attempt_at",
        "delivered_at",
    )
