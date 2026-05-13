import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User
from app.schemas.user import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    UserUpdate,
)
from app.services import auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await auth_service.authenticate_user(db, data.username, data.password)
    token = auth_service.create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=token)


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("superadmin")),
):
    """Only superadmins can register new users."""
    return await auth_service.register_user(db, data)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/users", response_model=list)
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("superadmin")),
):
    """Only superadmins can list all users."""
    users = await auth_service.list_users(db)
    return [UserResponse.model_validate(u) for u in users]


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("superadmin")),
):
    """Only superadmins can update users."""
    return await auth_service.update_user(db, user_id, data)
