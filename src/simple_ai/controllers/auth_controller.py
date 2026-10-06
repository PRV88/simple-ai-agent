from typing import Any, Dict
from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from simple_ai.models import (
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from simple_ai.services.auth_service import (
    auth_service,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Admin / User",
)
async def register(request: UserRegisterRequest):
    """Controller: Registers user via AuthService."""
    new_user = await auth_service.register_user(
        username=request.username,
        email=request.email,
        password=request.password,
        full_name=request.full_name,
        role=request.role,
    )
    return new_user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login to obtain JWT access token",
)
async def login(request: UserLoginRequest):
    """Controller: Authenticates user credentials via AuthService."""
    auth_result = await auth_service.authenticate_user(
        username_or_email=request.username_or_email,
        password=request.password,
    )
    return auth_result


@router.post(
    "/token",
    response_model=TokenResponse,
    include_in_schema=False,
    summary="OAuth2 compatible token endpoint",
)
async def oauth2_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """Controller: Supports OAuth2 password grant form."""
    return await auth_service.authenticate_user(
        username_or_email=form_data.username,
        password=form_data.password,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile",
)
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Controller: Returns profile of logged-in user."""
    return current_user
