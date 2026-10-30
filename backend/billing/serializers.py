
from rest_framework import serializers


class BillingStatusSerializer(serializers.Serializer):
    plan = serializers.CharField()

    limits = serializers.DictField(
        child=serializers.IntegerField()
    )

    usage = serializers.DictField(
        child=serializers.IntegerField()
    )

    remaining = serializers.DictField(
        child=serializers.IntegerField()
    )
