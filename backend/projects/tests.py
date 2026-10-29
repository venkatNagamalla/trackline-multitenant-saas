
from rest_framework.test import APITestCase

from tenancy.models import User, Workspace, Membership
from projects.models import Project, Board, WorkflowStatus, Issue


class WorkspaceIsolationTests(APITestCase):
    def setUp(self):
        # Create users
        self.user_a = User.objects.create_user(
            username="user_a",
            email="user_a@example.com",
            password="TestPassA123!",
        )

        self.user_b = User.objects.create_user(
            username="user_b",
            email="user_b@example.com",
            password="TestPassB123!",
        )

        # Create workspaces
        self.workspace_a = Workspace.objects.create(
            name="Workspace A",
            slug="workspace-a",
        )

        self.workspace_b = Workspace.objects.create(
            name="Workspace B",
            slug="workspace-b",
        )

        Membership.objects.create(
            user=self.user_a,
            workspace=self.workspace_a,
            role=Membership.ADMIN,
        )

        Membership.objects.create(
            user=self.user_b,
            workspace=self.workspace_b,
            role=Membership.ADMIN,
        )

        # Create a project for each workspace
        self.project_a = Project.objects.create(
            workspace=self.workspace_a,
            name="User A Private Project",
            key="AAA",
            description="Private to Workspace A",
        )

        self.project_b = Project.objects.create(
            workspace=self.workspace_b,
            name="User B Project",
            key="BBB",
        )

        # Create boards
        self.board_a = Board.objects.create(
            workspace=self.workspace_a,
            project=self.project_a,
            name="Board A",
        )

        self.board_b = Board.objects.create(
            workspace=self.workspace_b,
            project=self.project_b,
            name="Board B",
        )

        # Create workflow statuses
        self.status_a = WorkflowStatus.objects.create(
            workspace=self.workspace_a,
            board=self.board_a,
            name="To Do",
            order=0,
        )

        self.status_b = WorkflowStatus.objects.create(
            workspace=self.workspace_b,
            board=self.board_b,
            name="To Do",
            order=0,
        )

        # Create an issue belonging to Workspace A
        self.issue_a = Issue.objects.create(
            workspace=self.workspace_a,
            project=self.project_a,
            board=self.board_a,
            status=self.status_a,
            title="Private Issue A",
            priority="high",
            reporter=self.user_a,
            rank=1.0,
        )

    def authenticate_as_b(self):
        self.client.force_authenticate(user=self.user_b)

    # PROJECT ISOLATION

    def test_user_b_cannot_see_user_a_projects(self):
        self.authenticate_as_b()

        response = self.client.get(
            "/api/projects/",
            HTTP_X_WORKSPACE=self.workspace_b.slug,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertNotEqual(
            response.data["results"][0]["id"],
            self.project_a.id,
        )

    def test_user_b_cannot_read_user_a_project(self):
        self.authenticate_as_b()

        response = self.client.get(
            f"/api/projects/{self.project_a.id}/",
            HTTP_X_WORKSPACE=self.workspace_b.slug,
        )

        self.assertEqual(response.status_code, 404)

    def test_user_b_cannot_update_user_a_project(self):
        self.authenticate_as_b()

        response = self.client.patch(
            f"/api/projects/{self.project_a.id}/",
            {"name": "Hacked Project"},
            format="json",
            HTTP_X_WORKSPACE=self.workspace_b.slug,
        )

        self.assertEqual(response.status_code, 404)

        self.project_a.refresh_from_db()
        self.assertEqual(
            self.project_a.name,
            "User A Private Project",
        )

    def test_user_b_cannot_delete_user_a_project(self):
        self.authenticate_as_b()

        response = self.client.delete(
            f"/api/projects/{self.project_a.id}/",
            HTTP_X_WORKSPACE=self.workspace_b.slug,
        )

        self.assertEqual(response.status_code, 404)
        self.assertTrue(
            Project.objects.filter(id=self.project_a.id).exists()
        )

    def test_user_b_cannot_use_user_a_workspace_slug(self):
        self.authenticate_as_b()

        response = self.client.get(
            "/api/projects/",
            HTTP_X_WORKSPACE=self.workspace_a.slug,
        )

        self.assertEqual(response.status_code, 403)

    # BOARD ISOLATION

    def test_user_b_cannot_see_user_a_boards(self):
        self.authenticate_as_b()

        response = self.client.get(
            "/api/projects/boards/",
            HTTP_X_WORKSPACE=self.workspace_b.slug,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            response.data["results"][0]["id"],
            self.board_b.id,
        )

    def test_user_b_cannot_read_user_a_board(self):
        self.authenticate_as_b()

        response = self.client.get(
            f"/api/projects/boards/{self.board_a.id}/",
            HTTP_X_WORKSPACE=self.workspace_b.slug,
        )

        self.assertEqual(response.status_code, 404)

    # ISSUE ISOLATION

    def test_user_b_cannot_see_user_a_issues(self):
        self.authenticate_as_b()

        response = self.client.get(
            "/api/projects/issues/",
            HTTP_X_WORKSPACE=self.workspace_b.slug,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_user_b_cannot_read_user_a_issue(self):
        self.authenticate_as_b()

        response = self.client.get(
            f"/api/projects/issues/{self.issue_a.id}/",
            HTTP_X_WORKSPACE=self.workspace_b.slug,
        )

        self.assertEqual(response.status_code, 404)

    # FOREIGN-KEY INJECTION

    def test_user_b_cannot_create_issue_using_user_a_project(self):
        self.authenticate_as_b()

        response = self.client.post(
            "/api/projects/issues/",
            {
                "title": "Injected Issue",
                "project": self.project_a.id,
                "board": self.board_b.id,
                "status": self.status_b.id,
                "priority": "high",
                "rank": 5.0,
            },
            format="json",
            HTTP_X_WORKSPACE=self.workspace_b.slug,
        )

        self.assertEqual(response.status_code, 400)

        self.assertFalse(
            Issue.objects.filter(
                workspace=self.workspace_b,
                title="Injected Issue",
            ).exists()
        )

class AttachmentCleanupTests(WorkspaceIsolationTests):

    def test_deleting_attachment_removes_physical_file(self):
        from django.core.files.base import ContentFile
        from projects.models import Attachment

        storage = Attachment._meta.get_field("file").storage
        file_content = b"Temporary attachment cleanup test"
        test_filename = "cleanup-test/trackline-cleanup-test.txt"

        # Create a temporary file in the configured storage.
        saved_name = storage.save(
            test_filename,
            ContentFile(file_content),
        )

        self.assertTrue(storage.exists(saved_name))

        try:
            # Create the attachment database record.
            attachment = Attachment.objects.create(
                workspace=self.workspace_a,
                issue=self.issue_a,
                uploaded_by=self.user_a,
                file=saved_name,
                original_filename="trackline-cleanup-test.txt",
                size=len(file_content),
            )

            # Delete the record; the post_delete signal should delete the file.
            attachment.delete()

            self.assertFalse(
                storage.exists(saved_name),
                "The physical attachment file should be deleted.",
            )
        finally:
            # Ensure no temporary file is left behind if the test fails.
            if storage.exists(saved_name):
                storage.delete(saved_name)


class AttachmentWorkspaceIsolationTests(WorkspaceIsolationTests):
    def setUp(self):
        super().setUp()

        from django.core.files.base import ContentFile
        from projects.models import Attachment

        self.attachment = Attachment.objects.create(
            workspace=self.workspace_a,
            issue=self.issue_a,
            uploaded_by=self.user_a,
            file=ContentFile(
                b"Private workspace attachment",
                name="private-test.txt",
            ),
            original_filename="private-test.txt",
            size=len(b"Private workspace attachment"),
        )

    def test_user_b_cannot_list_user_a_attachments(self):
        self.authenticate_as_b()

        response = self.client.get(
            f"/api/projects/issues/{self.issue_a.id}/attachments/",
            HTTP_X_WORKSPACE=self.workspace_b.slug,
        )

        self.assertIn(response.status_code, [200, 404])
        if response.status_code == 200:
            self.assertEqual(len(response.data.get("results", response.data)), 0)

    def test_user_b_cannot_download_user_a_attachment(self):
        self.authenticate_as_b()

        response = self.client.get(
            f"/api/projects/attachments/{self.attachment.id}/download/",
            HTTP_X_WORKSPACE=self.workspace_b.slug,
        )

        self.assertEqual(response.status_code, 404)

    def test_user_b_cannot_delete_user_a_attachment(self):
        self.authenticate_as_b()

        response = self.client.delete(
            f"/api/projects/attachments/{self.attachment.id}/",
            HTTP_X_WORKSPACE=self.workspace_b.slug,
        )

        self.assertEqual(response.status_code, 404)

        from projects.models import Attachment
        self.assertTrue(
            Attachment.objects.filter(id=self.attachment.id).exists()
        )