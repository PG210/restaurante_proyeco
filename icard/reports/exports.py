"""The columns of each report when it is downloaded as CSV."""

from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal

from django.utils import timezone

from products.service_day import business_zone
from reports import sales
from reports.csv_export import Cell
from reports.ranges import ReportRange

WEEKDAY_NAMES = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado',
    7: 'Domingo',
}

Table = tuple[list[str], list[list[Cell]]]


def _products(report: dict) -> Table:
    header = ['Producto', 'Categoría', 'Unidades', 'Consumo', '% del total']
    rows = [
        [row['name'], row['category'], row['units'], Decimal(row['amount']), Decimal(row['share'])]
        for row in report['products']
    ]
    return header, rows


def _categories(report: dict) -> Table:
    header = ['Categoría', 'Unidades', 'Consumo', '% del total']
    rows = [
        [row['name'], row['units'], Decimal(row['amount']), Decimal(row['share'])]
        for row in report['categories']
    ]
    return header, rows


def _hours(report: dict) -> Table:
    header = ['Día', 'Hora', 'Pedidos', 'Consumo']
    rows = [
        [WEEKDAY_NAMES[cell['weekday']], f'{cell["hour"]:02d}:00', cell['orders'], Decimal(cell['amount'])]
        for cell in report['cells']
    ]
    return header, rows


def _staff(report: dict) -> Table:
    tips = {row['user_id']: row for row in report['tips'] if row['user_id'] is not None}
    header = ['Persona', 'Consumo cargado', '% del total', 'Líneas', 'Cuentas', 'Propinas cobradas']
    rows = [
        [
            row['name'],
            Decimal(row['amount']),
            Decimal(row['share']),
            row['lines'],
            row['bills'],
            Decimal(tips.pop(row['user_id'])['tips']) if row['user_id'] in tips else None,
        ]
        for row in report['staff']
    ]
    rows += [[row['name'], None, None, None, None, Decimal(row['tips'])] for row in tips.values()]
    rows += [
        [row['name'], None, None, None, None, Decimal(row['tips'])]
        for row in report['tips']
        if row['user_id'] is None
    ]
    return header, rows


def _cancellations(report: dict) -> Table:
    header = ['Fecha', 'Mesa', 'Producto', 'Cantidad', 'Valor', 'Motivo', 'Cargado por']
    rows = [
        [
            timezone.localtime(row['created_at'], business_zone()).strftime('%Y-%m-%d %H:%M'),
            row['table_number'],
            row['product'],
            row['quantity'],
            Decimal(row['amount']),
            row['reason'],
            row['placed_by'],
        ]
        for row in report['latest']
    ]
    return header, rows


@dataclass(frozen=True)
class Report:
    slug: str
    build: Callable[[ReportRange], dict]
    table: Callable[[dict], Table]
    build_export: Callable[[ReportRange], dict] | None = None

    def export(self, report_range: ReportRange) -> Table:
        return self.table((self.build_export or self.build)(report_range))

    def filename(self, report_range: ReportRange) -> str:
        return f'reporte-{self.slug}-{report_range.first}-a-{report_range.last}.csv'


REPORTS = {
    'products': Report('productos', sales.products_report, _products),
    'categories': Report('categorias', sales.categories_report, _categories),
    'hours': Report('horas', sales.hours_report, _hours),
    'staff': Report('personal', sales.staff_report, _staff),
    'cancellations': Report(
        'cancelaciones',
        sales.cancellations_report,
        _cancellations,
        build_export=lambda report_range: sales.cancellations_report(report_range, latest_limit=None),
    ),
}
