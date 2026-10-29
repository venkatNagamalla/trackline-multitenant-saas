
import ipaddress
import socket
from urllib.parse import urlparse

from django.conf import settings
from rest_framework import serializers

from .models import WebhookEndpoint


ALLOWED_WEBHOOK_EVENTS = [
    "issue.created",
    "issue.moved",
    "sprint.completed",
]


class WebhookEndpointSerializer(serializers.ModelSerializer):
    secret = serializers.CharField(read_only=True)

    class Meta:
        model = WebhookEndpoint
        fields = [
            "id",
            "url",
            "secret",
            "events",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "secret",
            "created_at",
            "updated_at",
        ]

    def validate_events(self, value):
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError(
                "Provide at least one webhook event."
            )

        invalid_events = set(value) - set(ALLOWED_WEBHOOK_EVENTS)
        if invalid_events:
            raise serializers.ValidationError(
                f"Unsupported events: {', '.join(sorted(invalid_events))}"
            )

        if len(value) != len(set(value)):
            raise serializers.ValidationError(
                "Duplicate events are not allowed."
            )

        return value

    def validate_url(self, value):
        parsed = urlparse(value)

        if (
            parsed.scheme not in ("http", "https")
            or not parsed.hostname
        ):
            raise serializers.ValidationError(
                "Enter a valid HTTP or HTTPS webhook URL."
            )

        if parsed.username or parsed.password:
            raise serializers.ValidationError(
                "Webhook URLs must not contain credentials."
            )

        hostname = parsed.hostname.lower().rstrip(".")

        if not settings.DEBUG:
            if (
                hostname == "localhost"
                or hostname.endswith(".localhost")
                or hostname.endswith(".local")
            ):
                raise serializers.ValidationError(
                    "Local and internal hostnames are not allowed."
                )

            try:
                # Handle literal IPv4 and IPv6 addresses.
                try:
                    addresses = [ipaddress.ip_address(hostname)]
                except ValueError:
                    # Resolve DNS hostnames before accepting them.
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
                    raise serializers.ValidationError(
                        "Webhook URLs must resolve only to public IP addresses."
                    )

            except (socket.gaierror, OSError, ValueError):
                raise serializers.ValidationError(
                    "Webhook hostname could not be safely resolved."
                )

        return value
