"""
app/models/candidate.py
Low-level Candidate CRUD operations against MongoDB.
Top-level metadata fields are indexed for fast table queries.
All form fields live inside `data` for forward compatibility.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId

from app.db.mongo import get_db


def _candidates():
    col = get_db()["candidates"]
    col.create_index("batch_id")
    col.create_index("email")
    return col


def create_candidate(
    batch_id: str,
    name: str,
    email: str,
    data: Dict[str, Any],
    interview_status: Optional[str]   = None,
    screening_score:  Optional[float] = None,
    offer_letter_sent: Optional[bool] = None,
    exception_count:  int             = 0,
    flagged:          bool            = False,
) -> dict:
    now = datetime.utcnow()
    doc = {
        "batch_id":          batch_id,
        "name":              name,
        "email":             email,
        "interview_status":  interview_status,
        "screening_score":   screening_score,
        "offer_letter_sent": offer_letter_sent,
        "exception_count":   exception_count,
        "flagged":           flagged,
        "review_status":     None,
        "reviewed_by":       None,
        "review_note":       None,
        "data":              data,   # stores ALL form fields
        "created_at":        now,
        "updated_at":        now,
    }
    result = _candidates().insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


def get_candidates_by_batch(batch_id: str) -> List[dict]:
    docs = _candidates().find({"batch_id": batch_id}).sort("created_at", -1)
    return [_serialize(d) for d in docs]


def get_candidate_by_id(candidate_id: str) -> Optional[dict]:
    try:
        oid = ObjectId(candidate_id)
    except Exception:
        return None
    doc = _candidates().find_one({"_id": oid})
    return _serialize(doc) if doc else None


def update_candidate(candidate_id: str, updates: Dict[str, Any]) -> Optional[dict]:
    """
    Partial update. Pass any top-level or nested data fields.
    Always refreshes updated_at.
    """
    try:
        oid = ObjectId(candidate_id)
    except Exception:
        return None

    updates["updated_at"] = datetime.utcnow()
    _candidates().update_one({"_id": oid}, {"$set": updates})
    return get_candidate_by_id(candidate_id)


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    # Convert datetimes to ISO strings
    for key in ("created_at", "updated_at"):
        if isinstance(doc.get(key), datetime):
            doc[key] = doc[key].isoformat()
    return doc