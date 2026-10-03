from django.contrib.auth import authenticate
from django.shortcuts import render
from rest_framework import generics, permissions, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from . import models, serializers


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "login"

    def post(self, request):
        user = authenticate(username=request.data.get("username"), password=request.data.get("password"))
        if not user:
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key})


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    serializer_class = serializers.RegisterSerializer


class LogoutView(APIView):
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = serializers.ProfileSerializer

    def get_object(self):
        return self.request.user.profile


class SettingsView(generics.RetrieveUpdateAPIView):
    serializer_class = serializers.EditorSettingsSerializer

    def get_object(self):
        obj, _ = models.EditorSettings.objects.get_or_create(user=self.request.user)
        return obj


class OwnedViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return super().get_queryset().filter(**{self.owner_field: self.request.user})


class ProjectViewSet(OwnedViewSet):
    queryset = models.Project.objects.all()
    serializer_class = serializers.ProjectSerializer
    owner_field = "owner"

    def perform_create(self, s):
        s.save(owner=self.request.user)


class WorkspaceViewSet(OwnedViewSet):
    queryset = models.Workspace.objects.all()
    serializer_class = serializers.WorkspaceSerializer
    owner_field = "owner"

    def perform_create(self, s):
        s.save(owner=self.request.user)


class ReleaseList(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    serializer_class = serializers.ReleaseSerializer
    queryset = models.Release.objects.prefetch_related("downloads")


class LatestRelease(APIView):
    """Used by the desktop auto-updater: GET /api/releases/latest/?current=1.0.0"""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        rel = models.Release.objects.filter(channel=request.query_params.get("channel", "stable")).first()
        if not rel:
            return Response({"update_available": False})
        current = request.query_params.get("current", "0")
        return Response({
            "update_available": _vtuple(rel.version) > _vtuple(current),
            "release": serializers.ReleaseSerializer(rel).data,
        })


def _vtuple(v):
    try:
        return tuple(int(x) for x in v.split("."))
    except ValueError:
        return (0,)


class ExtensionList(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    serializer_class = serializers.ExtensionSerializer
    queryset = models.Extension.objects.all()


def download_page(request):
    rel = models.Release.objects.prefetch_related("downloads").first()
    return render(request, "core/download.html", {"release": rel})
