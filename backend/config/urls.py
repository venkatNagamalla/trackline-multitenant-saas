from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('tenancy.urls')),
    path('api/projects/', include('projects.urls')),
    path('api/audit/', include('audit.urls')),
    path('api/transitions/', include('projects.urls')),
    path('api/webhooks/', include('notifications.urls')),
    path('api/billing/', include('billing.urls')),
]