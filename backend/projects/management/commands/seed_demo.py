
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from tenancy.models import Workspace, Membership
from projects.models import (
    Project,
    Sprint,
    Board,
    WorkflowStatus,
    WorkflowTransition,
    Issue,
    Comment,
)


User = get_user_model()


class Command(BaseCommand):
    help = "Create sample Trackline demo data for two workspaces"

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("Creating Trackline demo data...")

        demo_workspaces = [
            {
                "name": "Acme Technologies",
                "slug": "acme-demo",
                "users": [
                    ("acme_admin", "acme.admin@demo.trackline.local", "admin"),
                    ("acme_member", "acme.member@demo.trackline.local", "member"),
                    ("acme_viewer", "acme.viewer@demo.trackline.local", "viewer"),
                ],
            },
            {
                "name": "Nova Solutions",
                "slug": "nova-demo",
                "users": [
                    ("nova_admin", "nova.admin@demo.trackline.local", "admin"),
                    ("nova_member", "nova.member@demo.trackline.local", "member"),
                    ("nova_viewer", "nova.viewer@demo.trackline.local", "viewer"),
                ],
            },
        ]

        password = "TracklineDemo@2026"
        today = timezone.localdate()

        for workspace_data in demo_workspaces:
            workspace, _ = Workspace.objects.get_or_create(
                slug=workspace_data["slug"],
                defaults={
                    "name": workspace_data["name"],
                    "plan": "free",
                },
            )

            self.stdout.write(
                self.style.SUCCESS(f"Workspace: {workspace.name}")
            )

            workspace_users = {}

            for username, email, role in workspace_data["users"]:
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        "email": email,
                        "first_name": username.split("_")[1].title(),
                        "is_active": True,
                    },
                )

                if created:
                    user.set_password(password)
                    user.save()

                Membership.objects.update_or_create(
                    user=user,
                    workspace=workspace,
                    defaults={"role": role},
                )

                workspace_users[role] = user

                self.stdout.write(
                    f"  User: {username} | Role: {role}"
                )

            admin = workspace_users["admin"]
            member = workspace_users["member"]

            for project_index in range(1, 3):
                project_key = f"{workspace.slug[:3].upper()}{project_index}"

                project, _ = Project.objects.get_or_create(
                    workspace=workspace,
                    key=project_key,
                    defaults={
                        "name": (
                            f"{workspace.name} Project {project_index}"
                        ),
                        "description": (
                            "A sample project for demonstrating "
                            "Trackline project management."
                        ),
                    },
                )

                board, _ = Board.objects.get_or_create(
                    workspace=workspace,
                    project=project,
                    defaults={"name": f"{project.name} Board"},
                )

                status_objects = {}

                for index, (status_name, is_done) in enumerate(
                    [
                        ("To Do", False),
                        ("In Progress", False),
                        ("Done", True),
                    ]
                ):
                    status, _ = WorkflowStatus.objects.get_or_create(
                        workspace=workspace,
                        board=board,
                        name=status_name,
                        defaults={
                            "order": index,
                            "is_done": is_done,
                        },
                    )
                    status_objects[status_name] = status

                for from_name, to_name in [
                    ("To Do", "In Progress"),
                    ("In Progress", "Done"),
                ]:
                    WorkflowTransition.objects.get_or_create(
                        board=board,
                        from_status=status_objects[from_name],
                        to_status=status_objects[to_name],
                    )

                sprint, _ = Sprint.objects.get_or_create(
                    workspace=workspace,
                    project=project,
                    name=f"{project.name} Sprint 1",
                    defaults={
                        "start": today,
                        "end": today + timedelta(days=14),
                        "state": "active",
                    },
                )

                sample_issues = [
                    (
                        "Set up project dashboard",
                        "Create and configure the project dashboard.",
                        "high",
                        "To Do",
                    ),
                    (
                        "Implement user authentication",
                        "Verify login and authentication workflows.",
                        "urgent",
                        "In Progress",
                    ),
                    (
                        "Prepare project documentation",
                        "Document the project setup and API usage.",
                        "medium",
                        "Done",
                    ),
                ]

                for issue_index, issue_data in enumerate(sample_issues):
                    title, description, priority, status_name = issue_data

                    issue, _ = Issue.objects.get_or_create(
                        workspace=workspace,
                        project=project,
                        title=title,
                        defaults={
                            "sprint": sprint,
                            "board": board,
                            "status": status_objects[status_name],
                            "description": description,
                            "priority": priority,
                            "assignee": member,
                            "reporter": admin,
                            "rank": float(issue_index),
                        },
                    )

                    Comment.objects.get_or_create(
                        workspace=workspace,
                        issue=issue,
                        author=admin,
                        body="This is a sample demo comment.",
                    )

                self.stdout.write(
                    self.style.SUCCESS(f"  Project: {project.name}")
                )

        self.stdout.write(
            self.style.SUCCESS(
                "\nTrackline demo data created successfully!"
            )
        )
        self.stdout.write(
            f"Demo password for newly created users: {password}"
        )
