"""
app/api/routes/authentication.py
Authentication endpoints.
- POST /api/auth/signup  — ONLY works if zero users exist (creates admin).
                           All other user creation is via admin endpoint.
- POST /api/auth/login   — standard login, returns JWT with role.
"""
from fastapi import APIRouter, HTTPException, status

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import create_user, get_user_by_email, get_user_count
from app.schemas.auth_schemas import AuthResponse, LoginRequest, SignupRequest, UserOut

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/signup", response_model=AuthResponse, status_code=201)
def signup(body: SignupRequest):
    """
    Bootstrap endpoint: only works when no users exist.
    Creates the first admin user. Blocked thereafter.
    """
    if get_user_count() > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Signup is disabled. Contact your administrator.",
        )

    hashed = hash_password(body.password)
    try:
        user = create_user(name=body.name, email=body.email, hashed_password=hashed, role="admin")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    token = create_access_token({"sub": user["id"], "email": body.email, "role": "admin"})
    return AuthResponse(
        access_token=token,
        user=UserOut(id=user["id"], name=body.name, email=body.email, role="admin"),
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest):
    """Authenticate a user and return a JWT with role."""
    user = get_user_by_email(body.email)
    if not user or not verify_password(body.password, user.get("password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    role  = user.get("role", "user")
    token = create_access_token({"sub": user["id"], "email": body.email, "role": role})
    return AuthResponse(
        access_token=token,
        user=UserOut(id=user["id"], name=user.get("name", ""), email=body.email, role=role),
    )