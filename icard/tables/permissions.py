TABLES_APP_LABEL = 'tables'

OPEN_TABLE = 'open_table'
ATTEND_BILL_REQUEST = 'attend_bill_request'


def qualified_permission(codename: str) -> str:
    return f'{TABLES_APP_LABEL}.{codename}'
