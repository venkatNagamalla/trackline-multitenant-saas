
from django.urls import path

from .views import (
    WebhookEndpointListCreateView,
    WebhookEndpointDetailView,
    WebhookTestEventView,
)

urlpatterns = [
    path(
        "",
        WebhookEndpointListCreateView.as_view(),
        name="webhook-list-create",
    ),
    path(
        "<int:pk>/",
        WebhookEndpointDetailView.as_view(),
        name="webhook-detail",
    ),
    path(
        "<int:pk>/test/",
        WebhookTestEventView.as_view(),
        name="webhook-test",
    ),
]
