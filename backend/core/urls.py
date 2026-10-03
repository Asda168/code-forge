from django.urls import path

from . import views

urlpatterns = [
    path("", views.download_page, name="download"),
    path("download/", views.download_page),
]
