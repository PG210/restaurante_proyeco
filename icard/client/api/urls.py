from django.urls import path

from client.api.views import ClientBillView, ClientOrdersView, ClientTableView, ClientWaiterView

urlpatterns = [
    path('client/<str:token>/', ClientTableView.as_view(), name='client_table'),
    path('client/<str:token>/orders/', ClientOrdersView.as_view(), name='client_orders'),
    path('client/<str:token>/bill/', ClientBillView.as_view(), name='client_bill'),
    path('client/<str:token>/call-waiter/', ClientWaiterView.as_view(), name='client_call_waiter'),
]
