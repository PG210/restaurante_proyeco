PAYMENTS_APP_LABEL = 'payments'

CHARGE_BILL = 'charge_bill'
VIEW_PAYMENTS = 'view_payments'
CLOSE_CASH_REGISTER = 'close_cash_register'


def qualified_permission(codename: str) -> str:
    return f'{PAYMENTS_APP_LABEL}.{codename}'
