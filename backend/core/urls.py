from django.urls import path

from . import views

urlpatterns = [
    path("", views.download_page, name="download"),
    path("robots.txt", views.robots_txt),
    path("sitemap.xml", views.sitemap_xml),
    path("og.png", views.og_image),
    path("shots/<str:name>.webp", views.shot_image),
    path("download/", views.download_page),
    path("docs/", views.docs_page),
    path("docs/<path:path>", views.docs_page),
]
