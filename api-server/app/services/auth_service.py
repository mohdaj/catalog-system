import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from jose import JWTError, jwt
import bcrypt as _bcrypt
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.schemas.user import RegisterRequest

# --- Config ---
SECRET_KEY = "change-this-to-a-secure-random-string-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


# --- Password helpers ---

def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# --- JWT helpers ---

def create_access_token(user_id: uuid.UUID, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


# --- User CRUD ---

async def authenticate_user(db: AsyncSession, username: str, password: str) -> User:
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is disabled")
    return user


async def register_user(db: AsyncSession, data: RegisterRequest) -> User:
    # Check username/email uniqueness
    existing = await db.execute(select(User).where(User.username == data.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already taken")

    existing_email = await db.execute(select(User).where(User.email == data.email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def list_users(db: AsyncSession) -> list:
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


async def get_user_count(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(User.id)))
    return result.scalar_one()


async def update_user(db: AsyncSession, user_id: uuid.UUID, data) -> User:
    """Update a user's email, role, active status, or password."""
    user = await get_user_by_id(db, user_id)
    update_data = data.model_dump(exclude_unset=True)

    # Hash password if provided
    if "password" in update_data:
        user.hashed_password = hash_password(update_data.pop("password"))

    for key, value in update_data.items():
        setattr(user, key, value)
    await db.flush()
    await db.refresh(user)
    return user


async def delete_user(db: AsyncSession, user_id: uuid.UUID,user:User)  -> None:
    """Update a user's email, role, active status, or password."""
    if user.id == user_id:
        raise HTTPException(status_code=409, detail="User can't delete their own account")
    user = await get_user_by_id(db, user_id)
    await db.delete(user)
    await db.flush()



async def seed_superadmin(db: AsyncSession) -> None:
    """Create a default superadmin if no users exist."""
    count = await get_user_count(db)
    if count == 0:
        user = User(
            username="ubg",
            email="info@unauibike.sa",
            hashed_password=hash_password("66452568"),
            role=UserRole.SUPERADMIN,
        )
        db.add(user)
        await db.flush()
