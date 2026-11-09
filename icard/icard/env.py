import os

from django.core.exceptions import ImproperlyConfigured

TRUE_VALUES = frozenset({'1', 'true', 'yes', 'on'})
LIST_SEPARATOR = ','


def require_env(name: str) -> str:
    value = os.environ.get(name, '').strip()
    if not value:
        raise ImproperlyConfigured(f'Falta la variable de entorno obligatoria {name}.')
    return value


def env_str(name: str, default: str) -> str:
    return os.environ.get(name, default).strip() or default


def env_bool(name: str, default: bool) -> bool:
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in TRUE_VALUES


def env_int(name: str, default: int) -> int:
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    try:
        return int(raw_value)
    except ValueError as error:
        raise ImproperlyConfigured(f'La variable {name} debe ser un número entero.') from error


def env_list(name: str, default: list[str]) -> list[str]:
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    return [item.strip() for item in raw_value.split(LIST_SEPARATOR) if item.strip()]
