"""
app/models/user.py
Low-level user CRUD operations against MongoDB.
All DB interaction lives here so routes stay thin.
"""
from datetime import datetime
from typing import Optional

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.db.mongo import get_db


def _users():
    col = get_db()["users"]
    col.create_index("email", unique=True)
    return col


def create_user(name: str, email: str, hashed_password: str) -> dict:
    """
    Insert a new user. Returns the created document (with string id).
    Raises ValueError on duplicate email.
    """
    doc = {
        "name":       name,
        "email":      email,
        "password":   hashed_password,
        "provider":   "local",
        "created_at": datetime.utcnow(),
    }
    try:
        result = _users().insert_one(doc)
    except DuplicateKeyError:
        raise ValueError("An account with this email already exists.")

    doc["_id"] = result.inserted_id
    return _serialize(doc)


def get_user_by_email(email: str) -> Optional[dict]:
    """Return user dict or None."""
    doc = _users().find_one({"email": email})
    return _serialize(doc) if doc else None


def get_user_by_id(user_id: str) -> Optional[dict]:
    """Return user dict or None."""
    try:
        oid = ObjectId(user_id)
    except Exception:
        return None
    doc = _users().find_one({"_id": oid})
    return _serialize(doc) if doc else None


def _serialize(doc: dict) -> dict:
    """Convert ObjectId to string for JSON safety."""
    doc["id"] = str(doc.pop("_id"))
    return doc
