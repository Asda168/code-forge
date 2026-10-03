from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("projects", views.ProjectViewSet)
router.register("workspaces", views.WorkspaceViewSet)

urlpatterns = [
    path("auth/login/", views.LoginView.as_view()),
    path("auth/logout/", views.LogoutView.as_view()),
    path("auth/register/", views.RegisterView.as_view()),
    path("profile/", views.ProfileView.as_view()),
    path("settings/", views.SettingsView.as_view()),
    path("releases/", views.ReleaseList.as_view()),
    path("releases/latest/", views.LatestRelease.as_view()),
    path("extensions/", views.ExtensionList.as_view()),
    path("", include(router.urls)),
]
