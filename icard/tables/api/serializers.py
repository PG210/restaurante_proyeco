from rest_framework import serializers

from tables.models import Table

TABLE_STATE_FIELDS = ['is_open', 'opened_at', 'bill_requested']


class TableSerializer(serializers.ModelSerializer):
    bill_requested = serializers.BooleanField(read_only=True)

    class Meta:
        model = Table
        fields = ['id', 'number', *TABLE_STATE_FIELDS]
        read_only_fields = ['is_open', 'opened_at']


class TableAdminSerializer(TableSerializer):
    class Meta(TableSerializer.Meta):
        fields = [*TableSerializer.Meta.fields, 'token']
        read_only_fields = [*TableSerializer.Meta.read_only_fields, 'token']


class TableSummarySerializer(serializers.ModelSerializer):
    awaiting_payment = serializers.IntegerField(read_only=True)
    pending = serializers.IntegerField(read_only=True)
    preparing = serializers.IntegerField(read_only=True)
    ready = serializers.IntegerField(read_only=True)
    bill_requested = serializers.BooleanField(read_only=True)

    class Meta:
        model = Table
        fields = [
            'id',
            'number',
            'is_open',
            'bill_requested',
            'awaiting_payment',
            'pending',
            'preparing',
            'ready',
        ]
