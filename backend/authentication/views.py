from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.mail import send_mail
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
import secrets
import uuid

from .models import Owner, PasswordResetToken
from .serializers import (
    RegisterSerializer, LoginSerializer, TokenSerializer,
    PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
    OwnerSerializer
)

class AuthViewSet(viewsets.ViewSet):
    """
    Auth endpoints:
    - POST /api/auth/register/ - One-time signup
    - POST /api/auth/login/ - Login with email + password
    - POST /api/auth/password-reset-request/ - Request reset email
    - POST /api/auth/password-reset-confirm/ - Reset with token
    - GET /api/auth/check-owner/ - Check if owner exists
    - GET /api/auth/me/ - Get current owner (requires auth)
    """
    
    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def check_owner(self, request):
        """Check if owner account exists"""
        owner_exists = Owner.owner_exists()
        return Response({
            'owner_exists': owner_exists
        })
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """Get current owner profile"""
        owner = request.user
        serializer = OwnerSerializer(owner)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def register(self, request):
        """
        One-time owner registration
        
        POST /api/auth/register/
        {
            "email": "owner@medicalshop.com",
            "password": "SecurePassword123",
            "password_confirm": "SecurePassword123",
            "first_name": "John",
            "last_name": "Doe"
        }
        """
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            owner = serializer.save()
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(owner)
            
            return Response({
                'message': 'Owner account created successfully',
                'owner': OwnerSerializer(owner).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def login(self, request):
        """
        Owner login
        
        POST /api/auth/login/
        {
            "email": "owner@medicalshop.com",
            "password": "SecurePassword123"
        }
        """
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            owner = serializer.validated_data['owner']
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(owner)
            
            return Response({
                'message': 'Login successful',
                'owner': OwnerSerializer(owner).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def password_reset_request(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        owner = Owner.objects.get(email=email)

        reset_token = secrets.token_urlsafe(32)

        token_obj, created = PasswordResetToken.objects.get_or_create(
            owner=owner,
            defaults={
                "token": reset_token,
                "expires_at": timezone.now() + timedelta(hours=48),
            }
        )

        if not created:
            token_obj.token = reset_token
            token_obj.expires_at = timezone.now() + timedelta(hours=48)
            token_obj.is_used = False
            token_obj.save()

        if self._send_password_reset_email(email, reset_token):
            return Response(
                {"message": "Password reset email sent successfully"},
                status=status.HTTP_200_OK
            )

        if settings.DEBUG:
            return Response(
                {
                    "message": "Email not configured (dev mode)",
                    "debug_token": reset_token
                },
                status=status.HTTP_200_OK
            )

        return Response(
            {"error": "Email service not configured"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def password_reset_confirm(self, request):
        """
        Confirm password reset with token
        
        POST /api/auth/password-reset-confirm/
        {
            "token": "reset_token_from_email",
            "password": "NewPassword123",
            "password_confirm": "NewPassword123"
        }
        """
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            reset_token = serializer.validated_data['reset_token']
            new_password = serializer.validated_data['password']
            
            # Update owner password
            owner = reset_token.owner
            owner.set_password(new_password)
            owner.save()
            
            # Mark token as used
            reset_token.is_used = True
            reset_token.save()
            
            # Generate new JWT tokens for immediate login
            refresh = RefreshToken.for_user(owner)
            
            return Response({
                'message': 'Password reset successfully',
                'owner': OwnerSerializer(owner).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def admin_reset_password(self, request):
        password = request.data.get("password")
    
        if not password or len(password) < 8:
            return Response(
                {"error": "Password must be at least 8 characters"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
        owner = Owner.objects.first()
        owner.set_password(password)
        owner.save()
    
        return Response(
            {"message": "Password reset successfully"},
            status=status.HTTP_200_OK
        )
    

    
    def _send_password_reset_email(self, email, reset_token):
        """
        Send password reset email
        Returns True if successful, False if email not configured
        """
        if not email or not isinstance(email, str) or not email.strip():
            print("Invalid email address provided.")
            return False
        try:
            # Build reset link
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            reset_link = f"{frontend_url}/reset-password/{reset_token}"
            
            # Email content
            subject = 'Medical Shop - Password Reset'
            message = f"""
Hello,

You requested a password reset. Click the link below to reset your password:

{reset_link}

This link will expire in 24 hours.

If you didn't request this, please ignore this email.

Best regards,
Medical Shop System
            """.strip()
            
            html_message = f"""
<h2>Password Reset Request</h2>
<p>You requested a password reset. <a href="{reset_link}">Click here to reset your password</a></p>
<p>This link will expire in 24 hours.</p>
<p>If you didn't request this, please ignore this email.</p>
            """
            
            # Send email
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                html_message=html_message,
                fail_silently=False,
            )
            
            return True
        
        except Exception as e:
            print(f"Error sending email: {e}")
            return False
