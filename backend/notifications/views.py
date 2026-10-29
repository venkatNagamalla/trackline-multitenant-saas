
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from tenancy.permissions import IsWorkspaceMember

from .models import WebhookEndpoint
from .serializers import WebhookEndpointSerializer


class WebhookEndpointListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get(self, request):
        # Only workspace admins can list webhook endpoints.
        if request.membership.role != "admin":
            return Response(
                {"detail": "Only workspace admins can manage webhooks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        endpoints = WebhookEndpoint.objects.filter(
            workspace=request.workspace
        ).order_by("-created_at")

        serializer = WebhookEndpointSerializer(
            endpoints,
            many=True,
            context={"request": request},
        )
        return Response(serializer.data)

    def post(self, request):
        # Only workspace admins can create webhook endpoints.
        if request.membership.role != "admin":
            return Response(
                {"detail": "Only workspace admins can manage webhooks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = WebhookEndpointSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            endpoint = serializer.save(workspace=request.workspace)

        return Response(
            WebhookEndpointSerializer(endpoint).data,
            status=status.HTTP_201_CREATED,
        )


class WebhookEndpointDetailView(APIView):
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_endpoint(self, request, pk):
        # Restrict endpoint lookup to the current workspace.
        return WebhookEndpoint.objects.filter(
            pk=pk,
            workspace=request.workspace,
        ).first()

    def get(self, request, pk):
        # Only workspace admins can retrieve endpoint details.
        if request.membership.role != "admin":
            return Response(
                {"detail": "Only workspace admins can manage webhooks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        endpoint = self.get_endpoint(request, pk)
        if endpoint is None:
            return Response(
                {"detail": "Webhook endpoint not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(WebhookEndpointSerializer(endpoint).data)

    def patch(self, request, pk):
        # Only workspace admins can update endpoints.
        if request.membership.role != "admin":
            return Response(
                {"detail": "Only workspace admins can manage webhooks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        endpoint = self.get_endpoint(request, pk)
        if endpoint is None:
            return Response(
                {"detail": "Webhook endpoint not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = WebhookEndpointSerializer(
            endpoint,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(WebhookEndpointSerializer(endpoint).data)

    def delete(self, request, pk):
        # Only workspace admins can delete endpoints.
        if request.membership.role != "admin":
            return Response(
                {"detail": "Only workspace admins can manage webhooks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        endpoint = self.get_endpoint(request, pk)
        if endpoint is None:
            return Response(
                {"detail": "Webhook endpoint not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        endpoint.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WebhookTestEventView(APIView):
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def post(self, request, pk):
        if request.membership.role != "admin":
            return Response(
                {"detail": "Only workspace admins can manage webhooks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        endpoint = WebhookEndpoint.objects.filter(
            pk=pk,
            workspace=request.workspace,
            active=True,
        ).first()

        if endpoint is None:
            return Response(
                {"detail": "Active webhook endpoint not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        from .models import WebhookDelivery
        from .tasks import deliver_webhook

        payload = {
            "event": "webhook.test",
            "message": "This is a test webhook from Trackline.",
            "workspace": request.workspace.slug,
            "endpoint_id": endpoint.id,
        }

        with transaction.atomic():
            delivery = WebhookDelivery.objects.create(
                endpoint=endpoint,
                event="webhook.test",
                payload=payload,
            )

            transaction.on_commit(
                lambda delivery_id=delivery.id: deliver_webhook.delay(
                    delivery_id
                )
            )

        return Response(
            {
                "detail": "Test webhook queued successfully.",
                "delivery_id": delivery.id,
                "event": delivery.event,
                "status": delivery.status,
            },
            status=status.HTTP_202_ACCEPTED,
        )
