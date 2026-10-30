from django.urls import path

from .views import (
    BillingStatusView,
    CreateCheckoutSessionView,
    CreateCustomerPortalView,
    StripeWebhookView,
)

urlpatterns = [
    path("status/", BillingStatusView.as_view(), name="billing-status"),
    path("checkout/", CreateCheckoutSessionView.as_view(), name="billing-checkout"),
    path("portal/", CreateCustomerPortalView.as_view(), name="billing-portal"),
    path("webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
]