
from rest_framework.routers import DefaultRouter
from django.urls import path #=== para manejar los usuarios
from users.api.views import UserApiViewSet, UserView

#==import para manejar uusarios con el login
from rest_framework_simplejwt.views import TokenObtainPairView


router_user = DefaultRouter()

router_user.register(
    prefix='users', basename='users', viewset=UserApiViewSet
)

urlpatterns = [
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'), #login
    path('auth/me/', UserView.as_view())
]