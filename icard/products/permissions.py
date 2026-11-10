PRODUCTS_APP_LABEL = 'products'

SET_PRODUCT_AVAILABILITY = 'set_product_availability'
MANAGE_STOCK = 'manage_stock'


def qualified_permission(codename: str) -> str:
    return f'{PRODUCTS_APP_LABEL}.{codename}'
