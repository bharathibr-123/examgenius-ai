from django.urls import path

from . import views

urlpatterns = [
    path("subjects/", views.subjects),
    path("subjects/public/", views.subjects_public),
    path("subjects/<int:pk>/", views.subject_detail),
    path("subjects/<int:pk>/concept-map/", views.concept_map),
    path("faculty/overview/", views.faculty_overview),
    path("faculty/subjects/", views.faculty_add_subject),
    path("faculty/subjects/<int:pk>/topics/", views.faculty_add_topic),
]
