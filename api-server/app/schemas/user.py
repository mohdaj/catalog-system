import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.user import UserRole


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=6)


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.ADMIN


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserUpdate(BaseModel):
    email: Optional[str] = Field(None, min_length=5, max_length=255)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserListResponse(BaseModel):
    items: list
    total: int
