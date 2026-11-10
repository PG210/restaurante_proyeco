from django.urls import path

from configuration.api.views import RestaurantSettingsView, SettingsChangeListView

urlpatterns = [
    path('settings/', RestaurantSettingsView.as_view(), name='restaurant_settings'),
    path('settings/changes/', SettingsChangeListView.as_view(), name='restaurant_settings_changes'),
]
