from decimal import Decimal

from django.test import SimpleTestCase

from reports.csv_export import csv_text, safe_cell


class SafeCellTests(SimpleTestCase):
    def test_escapes_text_that_a_spreadsheet_would_run_as_a_formula(self) -> None:
        for text in ('=SUMA(A1:A9)', '+57 300', '-1', '@foo', '\tx', '\rx'):
            with self.subTest(text=text):
                self.assertEqual(safe_cell(text), f"'{text}")

    def test_leaves_plain_text_alone(self) -> None:
        self.assertEqual(safe_cell('Café = rico'), 'Café = rico')

    def test_numbers_stay_numbers_with_a_decimal_comma(self) -> None:
        self.assertEqual(safe_cell(Decimal('-1000.50')), '-1000,50')
        self.assertEqual(safe_cell(-3), '-3')
        self.assertEqual(safe_cell(None), '')


class CsvTextTests(SimpleTestCase):
    def test_starts_with_a_bom_and_separates_columns_with_semicolons(self) -> None:
        text = csv_text(['Producto', 'Valor'], [['Pan; integral', Decimal('2.5')]])

        self.assertEqual(text, '﻿Producto;Valor\r\n"Pan; integral";2,5\r\n')
