"""
app/models/batch.py
Low-level Batch CRUD operations against MongoDB.
"""
from datetime import datetime
from typing import Optional

from bson import ObjectId

from app.db.mongo import get_db


def _batches():
    return get_db()["batches"]


def create_batch(name: str, program: str, start_date: str, intake_size: int, created_by: str) -> dict:
    doc = {
        "name":        name,
        "program":     program,
        "start_date":  start_date,
        "intake_size": intake_size,
        "created_by":  created_by,
        "created_at":  datetime.utcnow(),
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