import datetime
from datetime import timezone
import logging
from typing import Any, Dict, Optional
import bcrypt
import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from simple_ai.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
)
from simple_ai.exceptions import (
    ConflictException,
    ForbiddenException,
    NotFoundException,
    UnauthorizedException,
)
from simple_ai.repositories.user_repository import user_repository

logger = logging.getLogger("simple_ai.services.auth")

security = HTTPBearer(auto_error=False)


class AuthService:
    """Service handling user authentication, registration, password hashing, and token issuance."""

    def __init__(self):
        self.user_repo = user_repository

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash plain password using bcrypt."""
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
        return hashed.decode("utf-8")

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify plain password against bcrypt hash."""
        try:
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        except Exception:
            return False

    @staticmethod
    def create_access_token(data: Dict[str, Any], expires_delta: Optional[datetime.timedelta] = None) -> str:
        """Create signed JWT access token."""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.datetime.now(timezone.utc) + datetime.timedelta(
                minutes=ACCESS_TOKEN_EXPIRE_MINUTES
            )

        to_encode.update({"exp": expire, "iat": datetime.datetime.now(timezone.utc)})
        return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

    @staticmethod
    def decode_access_token(token: str) -> Dict[str, Any]:
        """Decode and validate a JWT access token."""
        try:
            return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            raise UnauthorizedException("Token has expired. Please log in again.")
        except jwt.PyJWTError:
            raise UnauthorizedException("Invalid authentication credentials.")

    async def register_user(
        self,
        username: str,
        email: str,
        password: str,
        full_name: Optional[str] = None,
        role: str = "admin",
    ) -> Dict[str, Any]:
        """Validates uniqueness and registers a new user."""
        existing = await self.user_repo.find_by_username_or_email(username)
        if existing and existing["username"] == username:
            raise ConflictException(f"Username '{username}' is already registered.")

        existing_email = await self.user_repo.find_by_username_or_email(email)
        if existing_email and existing_email["email"] == email:
            raise ConflictException(f"Email '{email}' is already registered.")

        pwd_hash = self.hash_password(password)
        new_user = await self.user_repo.create_user(
            username=username,
            email=email,
            password_hash=pwd_hash,
            full_name=full_name,
            role=role,
        )
        logger.info(f"Registered user '{username}' (Role: {role}).")
        return new_user

    async def authenticate_user(self, username_or_email: str, password: str) -> Dict[str, Any]:
        """Validates credentials and returns access token and user info."""
        user = await self.user_repo.find_by_username_or_email(username_or_email)
        if not user or not self.verify_password(password, user["password_hash"]):
            raise UnauthorizedException("Incorrect username/email or password.")

        if not user.get("is_active", True):
            raise ForbiddenException("User account is inactive. Please contact system administrator.")

        token = self.create_access_token(data={"sub": user["username"], "role": user["role"]})
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": user,
        }

    async def get_user_by_token(self, token: str) -> Dict[str, Any]:
        """Validates token payload and fetches user from DB."""
        payload = self.decode_access_token(token)
        username = payload.get("sub")
        if not username:
            raise UnauthorizedException("Token payload missing user identifier.")

        user = await self.user_repo.find_by_username_or_email(username)
        if not user:
            raise NotFoundException("User associated with this token does not exist.")

        if not user.get("is_active", True):
            raise ForbiddenException("User account is inactive.")

        return user


auth_service = AuthService()


# ------------------------------------------------------------------
# FastAPI Security Dependencies
# ------------------------------------------------------------------
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    if not credentials or not credentials.credentials:
        raise UnauthorizedException("Authentication token is missing. Please log in.")
    return await auth_service.get_user_by_token(credentials.credentials)


async def get_current_admin(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if current_user.get("role") != "admin":
        raise ForbiddenException("Admin privileges required to access this resource.")
    return current_user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[Dict[str, Any]]:
    if not credentials or not credentials.credentials:
        return None
    try:
        return await auth_service.get_user_by_token(credentials.credentials)
    except Exception:
        return None

