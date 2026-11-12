from django.urls import path

from reports.api.views import DashboardView

urlpatterns = [
    path('reports/dashboard/', DashboardView.as_view(), name='reports_dashboard'),
]
