from django.contrib.auth.models import Group
from rest_framework import serializers

from users.models import User
from users.roles import DELEGABLE_PERMISSIONS, STAFF_ROLES
from users.services import get_user_permissions


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, style={'input_type': 'password'}
    )
    roles = serializers.SlugRelatedField(
        source='groups',
        slug_field='name',
        many=True,
        required=False,
        queryset=Group.objects.filter(name__in=STAFF_ROLES),
    )

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'password',
            'is_active',
            'is_staff',
            'roles',
        ]

    def validate(self, attrs: dict) -> dict:
        if self.instance is None and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'La contraseña es obligatoria.'})
        return attrs

    def create(self, validated_data: dict) -> User:
        user_fields = self._user_fields(validated_data)
        user = User(**user_fields)
        user.set_password(validated_data['password'])
        user.save()
        self._assign_roles(user, validated_data)
        return user

    def update(self, instance: User, validated_data: dict) -> User:
        for field, value in self._user_fields(validated_data).items():
            setattr(instance, field, value)
        if validated_data.get('password'):
            instance.set_password(validated_data['password'])
        instance.save()
        self._assign_roles(instance, validated_data)
        return instance

    @staticmethod
    def _user_fields(validated_data: dict) -> dict:
        return {key: value for key, value in validated_data.items() if key not in ('password', 'groups')}

    @staticmethod
    def _assign_roles(user: User, validated_data: dict) -> None:
        if 'groups' in validated_data:
            user.groups.set(validated_data['groups'])


class MeSerializer(UserSerializer):
    permissions = serializers.SerializerMethodField()

    class Meta(UserSerializer.Meta):
        fields = [*UserSerializer.Meta.fields, 'permissions']

    def get_permissions(self, user: User) -> list[str]:
        return get_user_permissions(user)


class RolePermissionsUpdateSerializer(serializers.Serializer):
    permissions = serializers.ListField(
        child=serializers.ChoiceField(choices=DELEGABLE_PERMISSIONS), allow_empty=True
    )

    def validate_permissions(self, permissions: list[str]) -> list[str]:
        return sorted(set(permissions))
