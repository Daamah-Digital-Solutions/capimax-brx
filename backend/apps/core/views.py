"""
Auth foundation endpoints. SPEC §5.2.

    POST /api/auth/register/          create user + profile(role=investor)
    POST /api/auth/login/             JWT access + refresh (+ user/profile)
    POST /api/auth/token/refresh/     rotate access token
    POST /api/auth/logout/            blacklist refresh token
    GET  /api/auth/session/           { user, session, profile }
    GET  /api/auth/me/                current user + profile
    POST /api/auth/password/reset/        request reset (stub email)
    POST /api/auth/password/reset/confirm/
    POST /api/auth/email/verify/          confirm email-verification token

OAuth (Google/Apple) scaffolding is documented in oauth.py + README; provider
keys are env-driven and inert until supplied. SPEC §5.2 / §6.
"""
from django.contrib.auth import get_user_model
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .emails import send_password_reset_email, send_verification_email
from .oauth import GoogleTokenError, verify_google_id_token
from .serializers import (
    EmailVerificationConfirmSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .tokens import email_verification_token, password_reset_token

User = get_user_model()


def _token_pair(user) -> dict:
    refresh = RefreshToken.for_user(user)
    return {"access_token": str(refresh.access_token), "refresh_token": str(refresh)}


class RegisterView(generics.CreateAPIView):
    """POST /api/auth/register/ — public. SPEC §4 / §5.2."""

    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Email-verification scaffolding (console email in dev). SPEC §5.2 / §6.
        verification_link = send_verification_email(user)

        body = {
            "user": UserSerializer(user).data,
            "session": _token_pair(user),  # immediate session, mirrors Supabase signUp
        }
        # Expose the link only in DEBUG to ease local testing; never in prod.
        from django.conf import settings

        if settings.DEBUG:
            body["debug_verification_link"] = verification_link
        return Response(body, status=status.HTTP_201_CREATED)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Login response includes the user+profile alongside the token pair. SPEC §5.2."""

    def validate(self, attrs):
        data = super().validate(attrs)
        return {
            "user": UserSerializer(self.user).data,
            "session": {
                "access_token": data["access"],
                "refresh_token": data["refresh"],
            },
        }


class LoginView(TokenObtainPairView):
    """POST /api/auth/login/ — public."""

    permission_classes = [AllowAny]
    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    """POST /api/auth/logout/ — blacklist the supplied refresh token. SPEC §5.2."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get("refresh") or request.data.get("refresh_token")
        if not token:
            return Response(
                {"detail": "A refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            RefreshToken(token).blacklist()
        except Exception:
            return Response(
                {"detail": "Invalid or already-blacklisted token."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(generics.RetrieveAPIView):
    """GET /api/auth/me/ — current user + profile. SPEC §5.2."""

    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class SessionView(APIView):
    """
    GET /api/auth/session/ — the exact shape the frontend AuthContext expects:
    { user: {id, email}, session: {access_token}, profile: {...} }. SPEC §5.2.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        access_token = auth_header.split(" ", 1)[1] if " " in auth_header else None
        profile = getattr(user, "profile", None)
        from .serializers import ProfileSerializer

        return Response(
            {
                "user": {"id": str(user.id), "email": user.email},
                "session": {"access_token": access_token},
                "profile": ProfileSerializer(profile).data if profile else None,
            }
        )


class PasswordResetRequestView(APIView):
    """POST /api/auth/password/reset/ — always 200 (no account enumeration). SPEC §5.2."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data["email"]).first()
        if user:
            send_password_reset_email(user)
        # Same response whether or not the email exists.
        return Response({"detail": "If the account exists, a reset link was sent."})


class PasswordResetConfirmView(APIView):
    """POST /api/auth/password/reset/confirm/ — set a new password from a token."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = _user_from_uid(serializer.validated_data["uid"])
        if user is None or not password_reset_token.check_token(
            user, serializer.validated_data["token"]
        ):
            return Response(
                {"detail": "Invalid or expired token."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Password updated."})


class EmailVerifyConfirmView(APIView):
    """POST /api/auth/email/verify/ — confirm an email-verification token. SPEC §5.2."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = EmailVerificationConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = _user_from_uid(serializer.validated_data["uid"])
        if user is None or not email_verification_token.check_token(
            user, serializer.validated_data["token"]
        ):
            return Response(
                {"detail": "Invalid or expired token."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.is_email_verified:
            user.is_email_verified = True
            user.save(update_fields=["is_email_verified"])
        return Response({"detail": "Email verified."})


class GoogleOAuthView(APIView):
    """
    POST /api/auth/oauth/google/ — sign in / sign up with a Google id_token.

    The SPA (GIS button) sends { id_token }. We verify it server-side, then
    get-or-create the user by email and return the same { user, session } shape
    as login. A signal creates the baseline (investor, active) profile on
    first sight; Google-verified email marks the account email-verified. SPEC §6.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("id_token") or request.data.get("credential")
        try:
            claims = verify_google_id_token(token)
        except GoogleTokenError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        email = claims["email"]
        user = User.objects.filter(email__iexact=email).first()
        created = user is None
        if created:
            # OAuth-only account: create_user(password=None) sets an unusable
            # password, so there's nothing to guess against. The post_save signal
            # creates the baseline (investor, active) profile.
            user = User.objects.create_user(email=email)

        # Google already verified the email; reflect that on our side.
        if not user.is_email_verified:
            user.is_email_verified = True
            user.save(update_fields=["is_email_verified"])

        if created:
            # Set the display name on first sight (never overwrite a later edit).
            profile = getattr(user, "profile", None)
            full_name = claims.get("name") or ""
            if profile is not None and full_name and not profile.full_name:
                profile.full_name = full_name
                profile.save(update_fields=["full_name"])

        return Response(
            {"user": UserSerializer(user).data, "session": _token_pair(user)},
            status=status.HTTP_200_OK,
        )


def _user_from_uid(uidb64: str):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        return User.objects.get(pk=uid)
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        return None
