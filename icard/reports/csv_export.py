"""CSV files that open cleanly in Excel set up in Spanish.

`;` separates the columns and `,` the decimals, with a UTF-8 BOM so accents survive. Text cells
written by the staff (product names, cancel reasons) are escaped so Excel never runs them as a
formula; numbers are written by the system and stay numbers.
"""

import csv
import datetime
import io
from collections.abc import Iterable, Sequence
from decimal import Decimal

from django.http import HttpResponse

BOM = '﻿'
DELIMITER = ';'
DECIMAL_SEPARATOR = ','
FORMULA_PREFIXES = ('=', '+', '-', '@', '\t', '\r')
FORMULA_ESCAPE = "'"
DATETIME_FORMAT = '%Y-%m-%d %H:%M'

Cell = str | int | Decimal | datetime.datetime | None


def safe_cell(value: Cell) -> str:
    if value is None:
        return ''
    if isinstance(value, datetime.datetime):
        return value.strftime(DATETIME_FORMAT)
    if isinstance(value, bool):
        return 'Sí' if value else 'No'
    if isinstance(value, Decimal):
        return str(value).replace('.', DECIMAL_SEPARATOR)
    if isinstance(value, int):
        return str(value)
    text = str(value)
    return FORMULA_ESCAPE + text if text.startswith(FORMULA_PREFIXES) else text


def csv_text(header: Sequence[str], rows: Iterable[Sequence[Cell]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=DELIMITER, lineterminator='\r\n')
    writer.writerow([safe_cell(column) for column in header])
    writer.writerows([safe_cell(cell) for cell in row] for row in rows)
    return BOM + buffer.getvalue()


def csv_response(filename: str, header: Sequence[str], rows: Iterable[Sequence[Cell]]) -> HttpResponse:
    response = HttpResponse(csv_text(header, rows), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
