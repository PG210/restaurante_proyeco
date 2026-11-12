"""Excel (.xlsx) files of the reports, with numbers, money and dates already formatted.

openpyxl stores any text starting with "=" as a formula. Text written by the staff (product
names, cancel reasons) is always forced to be a plain string so Excel never runs it.
"""

import io

from django.http import HttpResponse
from openpyxl import Workbook
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE, TYPE_STRING
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter

from reports.exports import Column, ExportTable, Kind

XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
SHEET_TITLE = 'Reporte'
NUMBER_FORMATS = {
    Kind.INTEGER: '0',
    Kind.MONEY: '#,##0.00',
    Kind.PERCENT: '0.0',
    Kind.MINUTES: '0.0',
    Kind.DATETIME: 'yyyy-mm-dd hh:mm',
}
MIN_COLUMN_WIDTH = 8
MAX_COLUMN_WIDTH = 50
WIDTH_PADDING = 2
DATETIME_WIDTH = 16


def _clean_text(value: str) -> str:
    return ILLEGAL_CHARACTERS_RE.sub('', value)


def _write_cell(sheet, row: int, column: int, value, kind: Kind) -> None:
    cell = sheet.cell(row=row, column=column)
    if value is None:
        return
    if isinstance(value, str):
        cell.value = _clean_text(value)
        cell.data_type = TYPE_STRING
        return
    cell.value = value
    if kind in NUMBER_FORMATS:
        cell.number_format = NUMBER_FORMATS[kind]


def _width(column: Column, values: list) -> int:
    if column.kind == Kind.DATETIME:
        longest = DATETIME_WIDTH
    else:
        longest = max([len(column.label), *(len(str(value)) for value in values if value is not None)])
    return min(max(longest + WIDTH_PADDING, MIN_COLUMN_WIDTH), MAX_COLUMN_WIDTH)


def xlsx_bytes(table: ExportTable) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = SHEET_TITLE
    bold = Font(bold=True)
    for index, column in enumerate(table.columns, start=1):
        _write_cell(sheet, 1, index, column.label, Kind.TEXT)
        sheet.cell(row=1, column=index).font = bold
    for row_number, row in enumerate(table.rows, start=2):
        for index, (column, value) in enumerate(zip(table.columns, row, strict=True), start=1):
            _write_cell(sheet, row_number, index, value, column.kind)
    for index, column in enumerate(table.columns, start=1):
        values = [row[index - 1] for row in table.rows]
        sheet.column_dimensions[get_column_letter(index)].width = _width(column, values)
    sheet.freeze_panes = 'A2'
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def xlsx_response(filename: str, table: ExportTable) -> HttpResponse:
    response = HttpResponse(xlsx_bytes(table), content_type=XLSX_CONTENT_TYPE)
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
