import datetime

from django.http import QueryDict
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from products.service_day import current_service_day
from reports.csv_export import csv_response
from reports.dashboard import dashboard
from reports.exports import REPORTS
from reports.ranges import ReportRange, ReportRangeError, report_range

EXPORT_PARAM = 'export'
CSV_EXPORT = 'csv'
DATE_PARAMS = {'from': 'desde', 'to': 'hasta'}


class DashboardView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(dashboard())


def _date_param(params: QueryDict, name: str) -> datetime.date | None:
    value = params.get(name)
    if not value:
        return None
    try:
        return datetime.date.fromisoformat(value)
    except ValueError:
        raise ValidationError(
            {name: [f'La fecha "{DATE_PARAMS[name]}" no es válida. Usa el formato AAAA-MM-DD.']}
        ) from None


def _range_from(params: QueryDict, today: datetime.date) -> ReportRange:
    try:
        return report_range(today, _date_param(params, 'from'), _date_param(params, 'to'))
    except ReportRangeError as error:
        raise ValidationError({'detail': str(error)}) from error


class SalesReportView(APIView):
    """One sales report for `?from=&to=` (service days); `&export=csv` downloads it."""

    permission_classes = [IsAdminUser]
    report_key = ''

    def get(self, request):
        report = REPORTS[self.report_key]
        today = current_service_day()
        selected = _range_from(request.query_params, today)
        if request.query_params.get(EXPORT_PARAM) == CSV_EXPORT:
            header, rows = report.export(selected)
            return csv_response(report.filename(selected), header, rows)
        data = report.build(selected)
        return Response({**data, 'range': {**data['range'], 'today': today}})
