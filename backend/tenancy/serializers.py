
from rest_framework import serializers
from .models import User, Invitation, Membership

# for signing up
class SignupSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={"input_type": "password"}
    )
    workspace_name = serializers.CharField(max_length=120)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                "This username is already taken."
            )
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )
        return value


# for login 
class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"}
    )

    def validate(self, attrs):
        email = attrs["email"]
        password = attrs["password"]

        user = User.objects.filter(
            email__iexact=email
        ).first()

        if user is None or not user.check_password(password):
            raise serializers.ValidationError(
                {"detail": "Invalid email or password."}
            )

        if not user.is_active:
            raise serializers.ValidationError(
                {"detail": "This account is inactive."}
            )

        attrs["user"] = user
        return attrs


class InvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invitation
        fields = [
            "id",
            "workspace",
            "email",
            "role",
            "token",
            "accepted_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "token",
            "accepted_at",
            "created_at",
        ]

    def validate_email(self, value):
        return value.strip().lower()

    def validate_role(self, value):
        if value not in [
            Membership.MEMBER,
            Membership.VIEWER,
        ]:
            raise serializers.ValidationError(
                "Invitations can assign only member or viewer roles."
            )
        return value


class AcceptInvitationSerializer(serializers.Serializer):
    username = serializers.CharField(
        max_length=150,
        required=False,
    )
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={"input_type": "password"},
    )

    def validate(self, attrs):
        invitation = self.context.get("invitation")
        if invitation is None:
            raise serializers.ValidationError(
                {"detail": "Invalid invitation."}
            )

        email = invitation.email.strip().lower()
        user = User.objects.filter(email__iexact=email).first()

        if user is None:
            # New users must choose a username.
            username = attrs.get("username")
            if not username:
                raise serializers.ValidationError(
                    {"username": "This field is required for new users."}
                )

            if User.objects.filter(username__iexact=username).exists():
                raise serializers.ValidationError(
                    {"username": "This username is already taken."}
                )

            attrs["is_new_user"] = True
        else:
            # Existing users must verify their current password.
            if not user.check_password(attrs["password"]):
                raise serializers.ValidationError(
                    {"detail": "Invalid password for this account."}
                )

            if not user.is_active:
                raise serializers.ValidationError(
                    {"detail": "This account is inactive."}
                )

            attrs["is_new_user"] = False

        attrs["user"] = user
        return attrs


class MemberRoleUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(
        choices=Membership.ROLES
    )
