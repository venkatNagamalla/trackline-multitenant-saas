
from rest_framework.test import APITestCase

from tenancy.models import User, Workspace, Membership
from projects.models import Project


class WorkspaceIsolationTests(APITestCase):
    def setUp(self):
        # Create User A
        self.user_a = User.objects.create_user(
            username="user_a",
            email="user_a@example.com",
            password="TestPassA123!"
        )

        # Create User B
        self.user_b = User.objects.create_user(
            username="user_b",
            email="user_b@example.com",
            password="TestPassB123!"
        )

        # Create Workspace A
        self.workspace_a = Workspace.objects.create(
            name="Workspace A",
            slug="workspace-a"
        )

        # Create Workspace B
        self.workspace_b = Workspace.objects.create(
            name="Workspace B",
            slug="workspace-b"
        )

        # Make User A an admin of Workspace A
        Membership.objects.create(
            user=self.user_a,
            workspace=self.workspace_a,
            role=Membership.ADMIN
        )

        # Make User B an admin of Workspace B
        Membership.objects.create(
            user=self.user_b,
            workspace=self.workspace_b,
            role=Membership.ADMIN
        )

        # Create a project belonging to Workspace A
        self.project_a = Project.objects.create(
            workspace=self.workspace_a,
            name="User A Private Project",
            description="This project must not be accessible to User B."
        )

    def test_user_b_cannot_see_user_a_projects(self):
        # Authenticate as User B
        self.client.force_authenticate(user=self.user_b)

        # Request projects in Workspace B
        response = self.client.get(
            "/api/projects/",
            HTTP_X_WORKSPACE=self.workspace_b.slug
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_user_b_cannot_read_user_a_project(self):
        # Authenticate as User B
        self.client.force_authenticate(user=self.user_b)

        # Try to read User A's project
        response = self.client.get(
            f"/api/projects/{self.project_a.id}/",
            HTTP_X_WORKSPACE=self.workspace_b.slug
        )

        self.assertEqual(response.status_code, 404)
    
    def test_user_b_cannot_update_user_a_project(self):
        self.client.force_authenticate(user=self.user_b)

        response = self.client.patch(
            f"/api/projects/{self.project_a.id}/",
            {"name": "Hacked Project"},
            format="json",
            HTTP_X_WORKSPACE=self.workspace_b.slug
        )

        self.assertEqual(response.status_code, 404)

        self.project_a.refresh_from_db()
        self.assertEqual(
            self.project_a.name,
            "User A Private Project"
        )
    def test_user_b_cannot_delete_user_a_project(self):
        self.client.force_authenticate(user=self.user_b)

        response = self.client.delete(
            f"/api/projects/{self.project_a.id}/",
            HTTP_X_WORKSPACE=self.workspace_b.slug
        )

        self.assertEqual(response.status_code, 404)

        # Confirm User A's project still exists
        self.assertTrue(
            Project.objects.filter(id=self.project_a.id).exists()
        )
    
    def test_user_b_cannot_use_user_a_workspace_slug(self):
        self.client.force_authenticate(user=self.user_b)

        response = self.client.get(
            "/api/projects/",
            HTTP_X_WORKSPACE=self.workspace_a.slug
        )

        self.assertEqual(response.status_code, 403)