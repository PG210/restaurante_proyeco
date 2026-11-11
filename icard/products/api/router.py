from rest_framework.routers import DefaultRouter

from products.api.views import ModifierGroupViewSet, ProductApiViewSet

router_product = DefaultRouter()

router_product.register(prefix='products', basename='products', viewset=ProductApiViewSet)
router_product.register(prefix='modifier-groups', basename='modifier-groups', viewset=ModifierGroupViewSet)
