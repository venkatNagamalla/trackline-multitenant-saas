
from django.db import transaction

from .models import WebhookDelivery, WebhookEndpoint
from .tasks import deliver_webhook


def queue_webhook_event(workspace, event, payload):
    """
    Create webhook deliveries for active endpoints subscribed to this event.
    Queue delivery tasks only after the surrounding database transaction commits.
    """
    endpoints = WebhookEndpoint.objects.filter(
        workspace=workspace,
        active=True,
        events__contains=[event],
    )

    delivery_ids = []

    for endpoint in endpoints:
        delivery = WebhookDelivery.objects.create(
            endpoint=endpoint,
            event=event,
            payload=payload,
        )
        delivery_ids.append(delivery.id)

        transaction.on_commit(
            lambda delivery_id=delivery.id: deliver_webhook.delay(
                delivery_id
            )
        )

    return delivery_ids
