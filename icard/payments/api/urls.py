from django.urls import path
from rest_framework.routers import DefaultRouter

from payments.api.cash_closings import CashClosingViewSet
from payments.api.views import BillViewSet, PaymentReverseView

router_bills = DefaultRouter()
router_bills.register(prefix='bills', basename='bills', viewset=BillViewSet)
router_bills.register(prefix='cash-closings', basename='cash-closings', viewset=CashClosingViewSet)

urlpatterns = [
    *router_bills.urls,
    path('payments/<int:pk>/reverse/', PaymentReverseView.as_view(), name='payment_reverse'),
]
