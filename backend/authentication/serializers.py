from rest_framework import serializers
from django.contrib.auth import authenticate
from django.utils import timezone
from datetime import timedelta
import uuid
import secrets
from .models import Owner, PasswordResetToken
from rest_framework_simplejwt.tokens import RefreshToken

class OwnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Owner
        fields = ['id', 'email', 'first_name', 'last_name', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class RegisterSerializer(serializers.Serializer):
    """Serializer for one-time owner registration"""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    
    def validate(self, data):
        # ✅ One-time signup: reject if owner already exists
        if Owner.owner_exists():
            raise serializers.ValidationError(
                "Owner account already exists. Please log in instead."
            )
        
        # Validate password confirmation
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError(
                {"password": "Passwords do not match."}
            )
        
        # Validate email uniqueness
        if Owner.objects.filter(email=data['email']).exists():
            raise serializers.ValidationError(
                {"email": "This email is already registered."}
            )
        
        return data
    
    def create(self, validated_data):
        """Create the owner account"""
        validated_data.pop('password_confirm')
        
        owner = Owner.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            is_active=True,
            is_setup_complete=True,
        )
        
        return owner


class LoginSerializer(serializers.Serializer):
    """Serializer for owner login"""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    
    def validate(self, data):
        email = data.get('email')
        password = data.get('password') 
        # Authenticate with email as username
        print("RAW PASSWORD FROM REQUEST:", repr(password))
        print("PASSWORD LENGTH:", len(password))
        try:
            owner = Owner.objects.get(email__iexact=email)
        except Owner.DoesNotExist:
            raise serializers.ValidationError(
                "Invalid email or password."
            )

        if not owner.check_password(password):
            raise serializers.ValidationError(
                "Invalid email or password."
            )

        if not owner.is_active:
            raise serializers.ValidationError(
                "This account is inactive."
            )

        print("EMAIL RECEIVED:", email)
        print("OWNER FOUND:", owner)
        print("PASSWORD VALID:", owner.check_password(password))
        
        data['owner'] = owner
        return data


class TokenSerializer(serializers.Serializer):
    """Return JWT tokens"""
    access = serializers.CharField()
    refresh = serializers.CharField()
    owner = OwnerSerializer()


class PasswordResetRequestSerializer(serializers.Serializer):
    """Request a password reset email"""
    email = serializers.EmailField()
    
    def validate_email(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Email cannot be empty.")
    
        try:
            Owner.objects.get(email=value)
        except Owner.DoesNotExist:
            raise serializers.ValidationError("No account found with this email.")
    
        return value
    


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Confirm password reset with token"""
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    
    def validate(self, data):
        # Validate passwords match
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError(
                {"password": "Passwords do not match."}
            )
        
        # Validate token exists and is valid
        try:
            reset_token = PasswordResetToken.objects.get(token=data['token'])
            if not reset_token.is_valid():
                raise serializers.ValidationError(
                    "Reset token is invalid or expired."
                )
        except PasswordResetToken.DoesNotExist:
            raise serializers.ValidationError(
                "Invalid reset token."
            )
        
        data['reset_token'] = reset_token
        return data
