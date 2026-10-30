
import stripe

from django.conf import settings
from django.utils import timezone

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied

from tenancy.models import Membership, Workspace
from tenancy.permissions import IsWorkspaceMember

from billing.models import Subscription
from billing.limits import PLAN_LIMITS
from billing.serializers import BillingStatusSerializer



class BillingStatusView(APIView):
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get(self, request):
        workspace = request.workspace

        limits = PLAN_LIMITS.get(
            workspace.plan.lower(),
            PLAN_LIMITS["free"],
        )

        usage = {
            "projects": workspace.projects.count(),
            "members": workspace.memberships.count(),
        }

        remaining = {
            resource: max(0, limits[resource] - usage[resource])
            for resource in limits
        }

        data = {
            "plan": workspace.plan,
            "limits": limits,
            "usage": usage,
            "remaining": remaining,
        }

        serializer = BillingStatusSerializer(data)
        return Response(serializer.data)



class CreateCheckoutSessionView(APIView):
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def post(self, request):
        workspace = request.workspace

        # Only workspace admins can upgrade the plan.
        membership = Membership.objects.get(
            user=request.user,
            workspace=workspace,
        )

        if membership.role != Membership.ADMIN:
            raise PermissionDenied(
                "Only workspace admins can upgrade the plan."
            )

        if workspace.plan == "pro":
            return Response(
                {"detail": "This workspace is already on the Pro plan."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stripe.api_key = settings.STRIPE_SECRET_KEY

        if not stripe.api_key or not settings.STRIPE_PRICE_ID:
            return Response(
                {"detail": "Stripe is not configured correctly."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Create a Stripe customer if one doesn't exist.
        if not workspace.stripe_customer_id:
            customer = stripe.Customer.create(
                name=workspace.name,
                metadata={
                    "workspace_id": str(workspace.id),
                    "workspace_slug": workspace.slug,
                },
            )

            workspace.stripe_customer_id = customer.id
            workspace.save(update_fields=["stripe_customer_id"])

        # Create a subscription checkout session.
        checkout_session = stripe.checkout.Session.create(
            customer=workspace.stripe_customer_id,
            mode="subscription",
            line_items=[
                {
                    "price": settings.STRIPE_PRICE_ID,
                    "quantity": 1,
                }
            ],
            success_url=(
                "http://localhost:5173/billing/success"
                "?session_id={CHECKOUT_SESSION_ID}"
            ),
            cancel_url="http://localhost:5173/billing/cancel",
            metadata={
                "workspace_id": str(workspace.id),
            },
            subscription_data={
                "metadata": {
                    "workspace_id": str(workspace.id),
                }
            },
        )

        return Response(
            {"checkout_url": checkout_session.url},
            status=status.HTTP_200_OK,
        )

class CreateCustomerPortalView(APIView):
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def post(self, request):
        workspace = request.workspace

        # Only workspace admins can manage billing.
        membership = Membership.objects.get(
            user=request.user,
            workspace=workspace,
        )

        if membership.role != Membership.ADMIN:
            raise PermissionDenied(
                "Only workspace admins can manage billing."
            )

        if not workspace.stripe_customer_id:
            return Response(
                {"detail": "No Stripe customer found for this workspace."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stripe.api_key = settings.STRIPE_SECRET_KEY

        if not stripe.api_key:
            return Response(
                {"detail": "Stripe is not configured correctly."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        portal_session = stripe.billing_portal.Session.create(
            customer=workspace.stripe_customer_id,
            return_url="http://localhost:5173/dashboard",
        )

        return Response(
            {"portal_url": portal_session.url},
            status=status.HTTP_200_OK,
        )

class StripeWebhookView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        payload = request.body
        signature = request.META.get("HTTP_STRIPE_SIGNATURE")

        try:
            event = stripe.Webhook.construct_event(
                payload,
                signature,
                settings.STRIPE_WEBHOOK_SECRET,
            )
        except ValueError:
            return Response(
                {"detail": "Invalid webhook payload."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except stripe.error.SignatureVerificationError:
            return Response(
                {"detail": "Invalid webhook signature."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_type = event["type"]
        event_data = event["data"]["object"].to_dict()

        if event_type == "checkout.session.completed":
            self.handle_checkout_completed(event_data)

        elif event_type == "customer.subscription.updated":
            self.handle_subscription_updated(event_data)

        elif event_type == "customer.subscription.deleted":
            self.handle_subscription_deleted(event_data)

        return Response({"received": True})

    def handle_checkout_completed(self, session):
        workspace_id = session.get("metadata", {}).get("workspace_id")

        if not workspace_id:
            return

        workspace = Workspace.objects.filter(id=workspace_id).first()

        if not workspace:
            return

        subscription_id = session.get("subscription")

        if not subscription_id:
            return

        stripe_subscription = stripe.Subscription.retrieve(
            subscription_id
        )

        self.save_subscription(workspace, stripe_subscription)

    def handle_subscription_updated(self, stripe_subscription):
        workspace_id = stripe_subscription.get("metadata", {}).get(
            "workspace_id"
        )

        if not workspace_id:
            return

        workspace = Workspace.objects.filter(id=workspace_id).first()

        if workspace:
            self.save_subscription(workspace, stripe_subscription)

    def handle_subscription_deleted(self, stripe_subscription):
        subscription = Subscription.objects.filter(
            stripe_subscription_id=stripe_subscription["id"]
        ).select_related("workspace").first()

        if subscription:
            subscription.status = "canceled"
            subscription.save(update_fields=["status", "updated_at"])

            workspace = subscription.workspace
            workspace.plan = "free"
            workspace.save(update_fields=["plan"])

    def save_subscription(self, workspace, stripe_subscription):
        price_id = ""

        items = stripe_subscription.get("items", {}).get("data", [])

        if items:
            price_id = items[0].get("price", {}).get("id", "")

        period_end = stripe_subscription.get("current_period_end")

        current_period_end = (
            timezone.datetime.fromtimestamp(
                period_end,
                tz=timezone.get_current_timezone(),
            )
            if period_end
            else None
        )

        Subscription.objects.update_or_create(
            stripe_subscription_id=stripe_subscription["id"],
            defaults={
                "workspace": workspace,
                "status": stripe_subscription["status"],
                "price_id": price_id,
                "current_period_end": current_period_end,
                "cancel_at_period_end": stripe_subscription.get(
                    "cancel_at_period_end",
                    False,
                ),
            },
        )

        if stripe_subscription["status"] in ("active", "trialing"):
            workspace.plan = "pro"
        else:
            workspace.plan = "free"

        workspace.save(update_fields=["plan"])
