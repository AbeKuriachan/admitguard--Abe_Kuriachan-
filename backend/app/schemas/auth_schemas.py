"""
app/schemas/auth_schemas.py
Pydantic schemas for auth request bodies and responses.
"""
from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    name:     str      = Field(..., min_length=1, max_length=100)
    email:    EmailStr
    password: str      = Field(..., min_length=8)


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


class UserOut(BaseModel):
    id:    str
    name:  str
    email: str
    role:  str = "user"


class AuthResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         UserOut