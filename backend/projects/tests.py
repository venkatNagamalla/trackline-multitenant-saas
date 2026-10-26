
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
