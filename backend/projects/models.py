from django.db import models

# Create your models here.


class Project(models.Model):
    workspace = models.ForeignKey(
        "tenancy.Workspace",
        on_delete=models.CASCADE,
        related_name="projects",
    )
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
