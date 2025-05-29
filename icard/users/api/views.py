from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.views import APIView #=== para manejar los admins que no pueden editar datos de otrso admins
from rest_framework.response import Response #=== para hacer las respuestas de los admin

from users.models import User
#=== importar el seralixzer
from users.api.serializers import UserSerializer
from django.contrib.auth.hashers import make_password #== encriptar las password


class UserApiViewSet(ModelViewSet):
    permission_class = [IsAdminUser] #===== que solamente los admin tengan acceso
    #serializer_class =  para ver como devuelve los datos
    serializer_class = UserSerializer
    queryset = User.objects.all() #=== aque modelo debe interactuar

    #==== encryp de password
    def create(self, request, *args, **kwargs):
        request.data['password']  = make_password(request.data['password'])
        return super().create(request, *args, **kwargs)
    
    #=== actualizar los datos del usuario y que la contraseña de encripte ==
    def partial_update(self, request, *args, **kwargs):
        password = request.data['password']
        if password:
            request.data['password'] = make_password(password)
        else:
            request.data['password'] = request.user.password
        
        return super().create(request, *args, **kwargs)

#==== recuperar los datos de los usuarios por los admins====================
class UserView(APIView):
    Permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)