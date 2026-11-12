"""The columns of each report when it is downloaded as CSV or Excel.

Each column has a kind so the Excel file can give it a number or date format; the CSV only
uses the labels.
"""

import datetime
import enum
from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal

from django.utils import timezone

from products.service_day import business_zone
from reports import kitchen, sales
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


class Kind(enum.Enum):
    TEXT = 'text'
    INTEGER = 'integer'
    MONEY = 'money'
    PERCENT = 'percent'
    MINUTES = 'minutes'
    DATETIME = 'datetime'


@dataclass(frozen=True)
class Column:
    label: str
    kind: Kind = Kind.TEXT


@dataclass(frozen=True)
class ExportTable:
    columns: list[Column]
    rows: list[list[Cell]]

    @property
    def header(self) -> list[str]:
        return [column.label for column in self.columns]


def _decimal(value: str | float | None) -> Decimal | None:
    return None if value is None else Decimal(str(value))


def _local(value: datetime.datetime | None) -> datetime.datetime | None:
    """Local wall time without zone: spreadsheets do not store time zones."""
    return None if value is None else timezone.localtime(value, business_zone()).replace(tzinfo=None)


def _products(report: dict) -> ExportTable:
    columns = [
        Column('Producto'),
        Column('Categoría'),
        Column('Unidades', Kind.INTEGER),
        Column('Consumo', Kind.MONEY),
        Column('% del total', Kind.PERCENT),
    ]
    rows = [
        [row['name'], row['category'], row['units'], _decimal(row['amount']), _decimal(row['share'])]
        for row in report['products']
    ]
    return ExportTable(columns, rows)


def _categories(report: dict) -> ExportTable:
    columns = [
        Column('Categoría'),
        Column('Unidades', Kind.INTEGER),
        Column('Consumo', Kind.MONEY),
        Column('% del total', Kind.PERCENT),
    ]
    rows = [
        [row['name'], row['units'], _decimal(row['amount']), _decimal(row['share'])]
        for row in report['categories']
    ]
    return ExportTable(columns, rows)


def _hours(report: dict) -> ExportTable:
    columns = [Column('Día'), Column('Hora'), Column('Pedidos', Kind.INTEGER), Column('Consumo', Kind.MONEY)]
    rows = [
        [WEEKDAY_NAMES[cell['weekday']], f'{cell["hour"]:02d}:00', cell['orders'], _decimal(cell['amount'])]
        for cell in report['cells']
    ]
    return ExportTable(columns, rows)


def _staff(report: dict) -> ExportTable:
    tips = {row['user_id']: row for row in report['tips'] if row['user_id'] is not None}
    columns = [
        Column('Persona'),
        Column('Consumo cargado', Kind.MONEY),
        Column('% del total', Kind.PERCENT),
        Column('Líneas', Kind.INTEGER),
        Column('Cuentas', Kind.INTEGER),
        Column('Propinas cobradas', Kind.MONEY),
    ]
    rows = [
        [
            row['name'],
            _decimal(row['amount']),
            _decimal(row['share']),
            row['lines'],
            row['bills'],
            _decimal(tips.pop(row['user_id'])['tips']) if row['user_id'] in tips else None,
        ]
        for row in report['staff']
    ]
    rows += [[row['name'], None, None, None, None, _decimal(row['tips'])] for row in tips.values()]
    rows += [
        [row['name'], None, None, None, None, _decimal(row['tips'])]
        for row in report['tips']
        if row['user_id'] is None
    ]
    return ExportTable(columns, rows)


def _cancellations(report: dict) -> ExportTable:
    columns = [
        Column('Pedido', Kind.DATETIME),
        Column('Mesa', Kind.INTEGER),
        Column('Producto'),
        Column('Cantidad', Kind.INTEGER),
        Column('Valor', Kind.MONEY),
        Column('Motivo'),
        Column('Cargado por'),
        Column('Cancelado', Kind.DATETIME),
        Column('Cancelado por'),
    ]
    rows = [
        [
            _local(row['created_at']),
            row['table_number'],
            row['product'],
            row['quantity'],
            _decimal(row['amount']),
            row['reason'],
            row['placed_by'],
            _local(row['cancelled_at']),
            row['cancelled_by'],
        ]
        for row in report['latest']
    ]
    return ExportTable(columns, rows)


def _kitchen(report: dict) -> ExportTable:
    columns = [
        Column('Producto'),
        Column('Pedidos medidos', Kind.INTEGER),
        Column('Mediana (min)', Kind.MINUTES),
        Column('Promedio (min)', Kind.MINUTES),
        Column('Estimado (min)', Kind.MINUTES),
        Column('% a tiempo', Kind.PERCENT),
        Column('Revisar estimado'),
    ]
    rows = [
        [
            row['name'],
            row['measured'],
            _decimal(row['median']),
            _decimal(row['average']),
            _decimal(row['estimate']),
            _decimal(row['on_time_percent']),
            'Sí' if row['review_estimate'] else '',
        ]
        for row in report['products']
    ]
    return ExportTable(columns, rows)


@dataclass(frozen=True)
class Report:
    slug: str
    build: Callable[[ReportRange], dict]
    table: Callable[[dict], ExportTable]
    build_export: Callable[[ReportRange], dict] | None = None

    def export(self, report_range: ReportRange) -> ExportTable:
        return self.table((self.build_export or self.build)(report_range))

    def filename(self, report_range: ReportRange, extension: str) -> str:
        return f'reporte-{self.slug}-{report_range.first}-a-{report_range.last}.{extension}'


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
    'kitchen': Report('cocina', kitchen.kitchen_report, _kitchen),
}
