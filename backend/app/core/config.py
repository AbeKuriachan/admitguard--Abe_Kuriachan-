"""
app/core/config.py
Centralised settings – loaded once from .env file.
Access anywhere with: from app.core.config import settings
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    MONGO_URI: str                   = "mongodb://localhost:27017"
    DB_NAME: str                     = "admitguard"
    SECRET_KEY: str                  = "change-me"
    ALGORITHM: str                   = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


# Singleton – imported everywhere
settings = Settings()
