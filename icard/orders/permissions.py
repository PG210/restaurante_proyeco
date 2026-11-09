ORDERS_APP_LABEL = 'orders'

VIEW_ORDER = 'view_order'
ADD_ORDER = 'add_order'
CHANGE_ORDER = 'change_order'
DELETE_ORDER = 'delete_order'
PREPARE_ORDER = 'prepare_order'
DELIVER_ORDER = 'deliver_order'
CANCEL_ORDER = 'cancel_order'


def qualified_permission(codename: str) -> str:
    return f'{ORDERS_APP_LABEL}.{codename}'
