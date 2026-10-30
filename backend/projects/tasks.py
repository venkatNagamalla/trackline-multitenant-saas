from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMessage
from django.db.models import Count, Q

from .models import Sprint, Issue
from tenancy.models import Membership 


@shared_task(bind=True, max_retries=3)
def send_sprint_report_email(self, sprint_id):
    try:
        sprint = Sprint.objects.select_related(
            "workspace",
            "project",
        ).get(id=sprint_id)

        issues = Issue.objects.filter(
            sprint=sprint,
            workspace=sprint.workspace,
            project=sprint.project,
        ).select_related("status", "assignee")

        total_issues = issues.count()
        completed_issues = issues.filter(
            status__is_done=True
        ).count()

        pending_issues = total_issues - completed_issues

        unassigned_issues = issues.filter(
            assignee__isnull=True
        ).count()

        priority_counts = {
            priority: issues.filter(priority=priority).count()
            for priority, label in Issue.PRIORITY_CHOICES
        }

        memberships = Membership.objects.filter(
            workspace=sprint.workspace,
        ).select_related("user")

        recipients = list(
            memberships.values_list("user__email", flat=True)
        )

        recipients = list({
            email.strip().lower()
            for email in recipients
            if email and email.strip()
        })

        if not recipients:
            return {
                "status": "skipped",
                "reason": "No workspace members have email addresses.",
                "sprint_id": sprint.id,
            }

        progress_percentage = (
            round((completed_issues / total_issues) * 100, 2)
            if total_issues else 0
        )

        priority_report = "\n".join(
            f"{priority.title()}: {count}"
            for priority, count in priority_counts.items()
        )

        message = (
            f"Hello Trackline Team,\n\n"
            f"Here is the sprint progress report.\n\n"
            f"Workspace: {sprint.workspace.name}\n"
            f"Project: {sprint.project.name}\n"
            f"Sprint: {sprint.name}\n"
            f"State: {sprint.get_state_display()}\n"
            f"Start Date: {sprint.start}\n"
            f"End Date: {sprint.end}\n\n"
            f"SPRINT SUMMARY\n"
            f"Total Issues: {total_issues}\n"
            f"Completed Issues: {completed_issues}\n"
            f"Pending Issues: {pending_issues}\n"
            f"Unassigned Issues: {unassigned_issues}\n"
            f"Progress: {progress_percentage}%\n\n"
            f"PRIORITY BREAKDOWN\n"
            f"{priority_report}\n\n"
            f"Thank you,\n"
            f"Trackline Team"
        )

        email = EmailMessage(
            subject=f"Sprint Report: {sprint.name}",
            body=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[],
            bcc=recipients,
        )

        email.send(fail_silently=False)

        return {
            "status": "success",
            "sprint_id": sprint.id,
            "total_issues": total_issues,
            "completed_issues": completed_issues,
            "recipients_count": len(recipients),
        }

    except Sprint.DoesNotExist:
        return {
            "status": "error",
            "reason": "Sprint not found.",
            "sprint_id": sprint_id,
        }

    except Exception as exc:
        raise self.retry(
            exc=exc,
            countdown=60,
        )