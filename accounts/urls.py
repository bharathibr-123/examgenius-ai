from django.urls import path

from . import views

urlpatterns = [
    path("csrf/", views.csrf),
    path("me/", views.me),
    path("register/", views.register),
    path("login/", views.login_view),
    path("logout/", views.logout_view),
    path("profile/", views.profile),
    path("password/", views.change_password),
    path("delete-account/", views.delete_account),
    path("password-reset/", views.password_reset),
    path("password-reset/confirm/", views.password_reset_confirm),
]
