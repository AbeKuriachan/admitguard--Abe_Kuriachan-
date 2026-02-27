"""
app/api/routes/admin.py
Admin-only endpoints.
- POST /api/admin/users  — create a new user with a specific role (admin only)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from app.core.security import decode_access_token, hash_password
from app.models.user import create_user
from app.schemas.auth_schemas import UserOut

router = APIRouter(prefix="/admin", tags=["Admin"])
bearer = HTTPBearer()

VALID_ROLES = {"admin", "manager", "user"}


class CreateUserRequest(BaseModel):
    name:     str       = Field(..., min_length=1, max_length=100)
    email:    EmailStr
    password: str       = Field(..., min_length=8)
    role:     str       = Field(..., pattern="^(admin|manager|user)$")


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")
    return payload


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return user


@router.post("/users", response_model=UserOut, status_code=201)
def create_new_user(body: CreateUserRequest, admin: dict = Depends(require_admin)):
    """Admin creates a new user with a specified role."""
    hashed = hash_password(body.password)
    try:
        user = create_user(
            name=body.name,
            email=body.email,
            hashed_password=hashed,
            role=body.role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return UserOut(id=user["id"], name=user["name"], email=user["email"], role=user["role"])