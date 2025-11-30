from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/tasks/", include("tasks.urls")),   # <-- important!
    path('', lambda request: HttpResponse("Backend is running")),
]
