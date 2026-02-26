"""
app/api/routes/authentication.py
Authentication endpoints: signup and login.
"""
from fastapi import APIRouter, HTTPException, status

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import create_user, get_user_by_email
from app.schemas.auth_schemas import AuthResponse, LoginRequest, SignupRequest, UserOut

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/signup", response_model=AuthResponse, status_code=201)
def signup(body: SignupRequest):
    """Register a new user and return a JWT."""
    hashed = hash_password(body.password)
    try:
        user = create_user(name=body.name, email=body.email, hashed_password=hashed)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    token = create_access_token({"sub": user["id"], "email": body.email})
    return AuthResponse(
        access_token=token,
        user=UserOut(id=user["id"], name=body.name, email=body.email),
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest):
    """Authenticate a user and return a JWT."""
    user = get_user_by_email(body.email)
    if not user or not verify_password(body.password, user.get("password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token({"sub": user["id"], "email": body.email})
    return AuthResponse(
        access_token=token,
        user=UserOut(id=user["id"], name=user.get("name", ""), email=body.email),
    )
