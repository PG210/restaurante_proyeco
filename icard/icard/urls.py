from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework.permissions import AllowAny

from categories.api.router import router_category
from orders.api.router import router_orders
from products.api.router import router_product
from tables.api.router import router_table
from users.api.router import router_user

schema_view = get_schema_view(
    openapi.Info(
        title='Proyecto de react',
        default_version='v1',
        description='Documentación del proyecto',
        terms_of_service='https://www.google.com/policies/terms/',
        contact=openapi.Contact(email='pedro@evolucion.co'),
        license=openapi.License(name='BSD License'),
    ),
    public=True,
    permission_classes=[AllowAny],
)


urlpatterns = [
    path('admin/', admin.site.urls),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    path('api/', include(router_user.urls)),
    path('api/', include('users.api.router')),
    path('api/', include(router_category.urls)),
    path('api/', include(router_product.urls)),
    path('api/', include(router_table.urls)),
    path('api/', include(router_orders.urls)),
    path('api/', include('client.api.urls')),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
