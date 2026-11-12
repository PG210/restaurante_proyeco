from django.urls import path

from reports.api.views import DashboardView, SalesReportView
from reports.exports import REPORTS

urlpatterns = [
    path('reports/dashboard/', DashboardView.as_view(), name='reports_dashboard'),
    *[
        path(f'reports/{key}/', SalesReportView.as_view(report_key=key), name=f'reports_{key}')
        for key in REPORTS
    ],
]
