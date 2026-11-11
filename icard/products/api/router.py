from rest_framework.routers import DefaultRouter

from products.api.views import AllergenViewSet, ModifierGroupViewSet, ProductApiViewSet, TagViewSet

router_product = DefaultRouter()

router_product.register(prefix='products', basename='products', viewset=ProductApiViewSet)
router_product.register(prefix='modifier-groups', basename='modifier-groups', viewset=ModifierGroupViewSet)
router_product.register(prefix='allergens', basename='allergens', viewset=AllergenViewSet)
router_product.register(prefix='tags', basename='tags', viewset=TagViewSet)
