
import hashlib
import hmac
import ipaddress
import json
import socket
from urllib.parse import urlparse

import requests
from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import WebhookDelivery


def validate_webhook_destination(url):
    """Reject unsafe destinations when running outside DEBUG mode."""
    if settings.DEBUG:
        return

    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower().rstrip(".")

    if (
        parsed.scheme not in ("http", "https")
        or not hostname
        or parsed.username
        or parsed.password
    ):
        raise ValueError("Invalid webhook URL.")

    if (
        hostname == "localhost"
        or hostname.endswith(".localhost")
        or hostname.endswith(".local")
    ):
        raise ValueError("Local and internal hostnames are not allowed.")

    try:
        try:
            addresses = [ipaddress.ip_address(hostname)]
        except ValueError:
            results = socket.getaddrinfo(
                hostname,
                parsed.port or (443 if parsed.scheme == "https" else 80),
                type=socket.SOCK_STREAM,
            )
            addresses = [
                ipaddress.ip_address(result[4][0].split("%")[0])
                for result in results
            ]

        if not addresses or any(
            not address.is_global for address in addresses
        ):
            raise ValueError(
                "Webhook destination must resolve only to public IP addresses."
            )

    except (socket.gaierror, OSError) as exc:
        raise ValueError(
            "Webhook hostname could not be safely resolved."
        ) from exc


@shared_task(bind=True, max_retries=5)
def deliver_webhook(self, delivery_id):
    delivery = WebhookDelivery.objects.select_related(
        "endpoint"
    ).get(pk=delivery_id)

    endpoint = delivery.endpoint

    if delivery.status == WebhookDelivery.STATUS_SUCCESS:
        return {"status": "success", "delivery_id": delivery.id}

    body = json.dumps(
        delivery.payload,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")

    signature = hmac.new(
        endpoint.secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Signature-SHA256": f"sha256={signature}",
        "X-Webhook-Event": delivery.event,
    }

    delivery.attempts += 1
    delivery.last_attempt_at = timezone.now()

    try:
        if not endpoint.active:
            raise ValueError("Webhook endpoint is inactive.")

        validate_webhook_destination(endpoint.url)

        response = requests.post(
            endpoint.url,
            data=body,
            headers=headers,
            timeout=10,
            allow_redirects=False,
        )

        delivery.response_status = response.status_code
        delivery.response_body = response.text[:5000]

        if 200 <= response.status_code < 300:
            delivery.status = WebhookDelivery.STATUS_SUCCESS
            delivery.delivered_at = timezone.now()
            delivery.last_error = ""
            delivery.save()
            return {"status": "success", "delivery_id": delivery.id}

        raise requests.exceptions.HTTPError(
            f"Webhook returned HTTP {response.status_code}"
        )

    except ValueError as exc:
        # Configuration and security failures should not be retried.
        delivery.status = WebhookDelivery.STATUS_FAILED
        delivery.last_error = str(exc)[:2000]
        delivery.save()
        return {"status": "failed", "delivery_id": delivery.id}

    except requests.exceptions.RequestException as exc:
        delivery.status = WebhookDelivery.STATUS_FAILED
        delivery.last_error = str(exc)[:2000]
        delivery.save()

        if self.request.retries < self.max_retries:
            raise self.retry(
                exc=exc,
                countdown=2 ** (self.request.retries + 1),
            )

        return {"status": "failed", "delivery_id": delivery.id}
