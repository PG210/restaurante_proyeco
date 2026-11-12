import datetime
import io
from decimal import Decimal

from django.test import SimpleTestCase
from openpyxl import load_workbook

from reports.exports import Column, ExportTable, Kind
from reports.xlsx_export import xlsx_bytes


def open_sheet(table: ExportTable):
    return load_workbook(io.BytesIO(xlsx_bytes(table))).active


class XlsxExportTests(SimpleTestCase):
    def test_numbers_money_and_dates_keep_their_type_and_format(self) -> None:
        when = datetime.datetime(2026, 11, 11, 20, 15)
        sheet = open_sheet(
            ExportTable(
                [
                    Column('Producto'),
                    Column('Unidades', Kind.INTEGER),
                    Column('Consumo', Kind.MONEY),
                    Column('Pedido', Kind.DATETIME),
                ],
                [['Café', 3, Decimal('9500.50'), when]],
            )
        )

        self.assertEqual([cell.value for cell in sheet[1]], ['Producto', 'Unidades', 'Consumo', 'Pedido'])
        self.assertTrue(sheet['A1'].font.bold)
        self.assertEqual(sheet['B2'].value, 3)
        self.assertEqual(sheet['C2'].value, 9500.5)
        self.assertEqual(sheet['C2'].number_format, '#,##0.00')
        self.assertEqual(sheet['D2'].value, when)
        self.assertEqual(sheet.freeze_panes, 'A2')

    def test_text_that_looks_like_a_formula_stays_text(self) -> None:
        sheet = open_sheet(
            ExportTable([Column('Motivo')], [['=HYPERLINK("http://x","clic")'], ['-1'], ['@foo']])
        )

        for row, text in ((2, '=HYPERLINK("http://x","clic")'), (3, '-1'), (4, '@foo')):
            with self.subTest(text=text):
                self.assertEqual(sheet.cell(row=row, column=1).value, text)
                self.assertEqual(sheet.cell(row=row, column=1).data_type, 's')

    def test_empty_cells_and_control_characters(self) -> None:
        sheet = open_sheet(ExportTable([Column('Nota'), Column('Valor', Kind.MONEY)], [['a\x01b', None]]))

        self.assertEqual(sheet['A2'].value, 'ab')
        self.assertIsNone(sheet['B2'].value)
