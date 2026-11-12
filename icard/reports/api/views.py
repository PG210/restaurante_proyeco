from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from reports.dashboard import dashboard


class DashboardView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(dashboard())
