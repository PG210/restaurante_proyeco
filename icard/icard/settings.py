"""
Django settings for icard project.

La configuración sensible o dependiente del entorno se lee de variables de
entorno; ver icard/.env.example.
"""

import datetime
from pathlib import Path

from dotenv import load_dotenv

from icard.env import env_bool, env_int, env_list, env_str, require_env

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / '.env')

SECRET_KEY = require_env('DJANGO_SECRET_KEY')

DEBUG = env_bool('DJANGO_DEBUG', default=False)

ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS', default=['127.0.0.1', 'localhost'])


INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'drf_yasg',
    'rest_framework',
    'django_filters',
    'corsheaders',
    'users',
    'categories',
    'products',
    'tables',
    'orders',
    'client',
    'payments',
    'configuration',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'icard.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'icard.wsgi.application'


DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': require_env('DB_NAME'),
        'USER': require_env('DB_USER'),
        'PASSWORD': require_env('DB_PASSWORD'),
        'HOST': env_str('DB_HOST', default='127.0.0.1'),
        'PORT': env_str('DB_PORT', default='5432'),
    }
}


AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework_simplejwt.authentication.JWTAuthentication',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    'DEFAULT_FILTER_BACKENDS': ['django_filters.rest_framework.DjangoFilterBackend'],
    'DEFAULT_THROTTLE_RATES': {
        'login': env_str('LOGIN_THROTTLE_RATE', default='5/min'),
        'anon': env_str('ANON_RATE', default='300/min'),
        'client_read': env_str('CLIENT_READ_RATE', default='60/min'),
        'client_order': env_str('CLIENT_ORDER_RATE', default='10/min'),
        'client_bill': env_str('CLIENT_BILL_RATE', default='3/min'),
        'client_ip': env_str('CLIENT_IP_RATE', default='300/min'),
    },
    'NUM_PROXIES': env_int('NUM_PROXIES', default=0),
}

REDIS_URL = env_str('REDIS_URL', default='')
if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
        }
    }

CLIENT_MAX_ITEMS_PER_ORDER = env_int('CLIENT_MAX_ITEMS_PER_ORDER', default=20)
CLIENT_MAX_QUANTITY_PER_ITEM = env_int('CLIENT_MAX_QUANTITY_PER_ITEM', default=20)
CLIENT_MAX_PENDING_ORDERS_PER_TABLE = env_int('CLIENT_MAX_PENDING_ORDERS_PER_TABLE', default=50)

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': datetime.timedelta(minutes=env_int('JWT_ACCESS_MINUTES', default=60)),
    'REFRESH_TOKEN_LIFETIME': datetime.timedelta(days=env_int('JWT_REFRESH_DAYS', default=7)),
}


LANGUAGE_CODE = 'es-es'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


STATIC_URL = 'static/'

MEDIA_URL = '/uploads/'
MEDIA_ROOT = BASE_DIR / 'uploads'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'users.User'


CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS', default=['http://localhost:3000'])
