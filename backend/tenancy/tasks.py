
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.urls import reverse

from .models import Invitation


@shared_task(bind=True, max_retries=3)
def send_invitation_email(self, invitation_id):
    try:
        invitation = Invitation.objects.select_related(
            "workspace"
        ).get(id=invitation_id)

        invite_link = (
            f"{settings.FRONTEND_URL}/invite/{invitation.token}"
        )

        subject = f"Invitation to join {invitation.workspace.name}"

        message = (
            f"Hello,\n\n"
            f"You have been invited to join "
            f"{invitation.workspace.name} "
            f"as a {invitation.role}.\n\n"
            f"Accept your invitation using this link:\n"
            f"{invite_link}\n\n"
            f"Thank you,\n"
            f"Trackline Team"
        )

        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invitation.email],
            fail_silently=False,
        )

        return {
            "status": "success",
            "invitation_id": invitation.id,
        }

    except Exception as exc:
        raise self.retry(
            exc=exc,
            countdown=60,
        )
