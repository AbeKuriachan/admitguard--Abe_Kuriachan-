"""
app/models/batch.py
Low-level Batch CRUD operations against MongoDB.
"""
from datetime import datetime
from typing import Any, Dict, Optional

from bson import ObjectId

from app.db.mongo import get_db

# ── Default eligibility rules config ─────────────────────────────────────────
# Mirrors rules_default.js on the frontend. Single source of truth on backend.
DEFAULT_RULES_CONFIG: Dict[str, Any] = {
    "full_name": {
        "type": "strict",
        "min_length": 2,
        "no_numbers": True,
        "label": "Full Name"
    },
    "email": {
        "type": "strict",
        "format": "email",
        "label": "Email"
    },
    "phone": {
        "type": "strict",
        "pattern": "indian_mobile",
        "label": "Phone"
    },
    "date_of_birth": {
        "type": "soft",
        "min_age": 18,
        "max_age": 35,
        "label": "Date of Birth"
    },
    "qualification": {
        "type": "strict",
        "allowed": ["B.Tech", "B.E", "B.Sc", "BCA", "M.Tech", "M.Sc", "MCA", "MBA"],
        "label": "Highest Qualification"
    },
    "graduation_year": {
        "type": "soft",
        "min": 2015,
        "max": 2025,
        "label": "Graduation Year"
    },
    "percentage_cgpa": {
        "type": "soft",
        "min_percent": 60.0,
        "min_cgpa": 6.0,
        "label": "Percentage / CGPA"
    },
    "screening_score": {
        "type": "soft",
        "min": 40,
        "max": 100,
        "label": "Screening Test Score"
    },
    "interview_status": {
        "type": "strict",
        "allowed": ["Cleared", "Waitlisted", "Rejected"],
        "label": "Interview Status"
    },
    "aadhaar": {
        "type": "strict",
        "digits": 12,
        "label": "Aadhaar Number"
    },
    "offer_letter": {
        "type": "strict",
        "depends_on": {"interview_status": ["Cleared", "Waitlisted"]},
        "label": "Offer Letter Sent"
    },
}


def _batches():
    return get_db()["batches"]


def create_batch(
    name: str,
    program: str,
    start_date: str,
    intake_size: int,
    created_by: str,
    rules_config: Optional[Dict[str, Any]] = None,
) -> dict:
    doc = {
        "name":         name,
        "program":      program,
        "start_date":   start_date,
        "intake_size":  intake_size,
        "created_by":   created_by,
        "rules_config": rules_config if rules_config is not None else DEFAULT_RULES_CONFIG,
        "created_at":   datetime.utcnow(),
    }
    result = _batches().insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


def get_all_batches(created_by: Optional[str] = None) -> list:
    query = {"created_by": created_by} if created_by else {}
    docs  = _batches().find(query).sort("created_at", -1)
    return [_serialize(d) for d in docs]


def get_batch_by_id(batch_id: str) -> Optional[dict]:
    try:
        oid = ObjectId(batch_id)
    except Exception:
        return None
    doc = _batches().find_one({"_id": oid})
    return _serialize(doc) if doc else None


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc