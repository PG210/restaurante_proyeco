from rest_framework import serializers

from tables.models import Table


class TableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Table
        fields = ['id', 'number']


class TableSummarySerializer(serializers.ModelSerializer):
    pending = serializers.IntegerField(read_only=True)
    preparing = serializers.IntegerField(read_only=True)
    ready = serializers.IntegerField(read_only=True)

    class Meta:
        model = Table
        fields = ['id', 'number', 'pending', 'preparing', 'ready']
