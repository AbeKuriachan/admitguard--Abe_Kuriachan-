"""
app/db/mongo.py
Single MongoDB client + database accessor.
Import get_db() wherever you need a collection:

    from app.db.mongo import get_db
    db  = get_db()
    col = db["my_collection"]
"""
from functools import lru_cache

from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import settings


@lru_cache(maxsize=1)
def _get_client() -> MongoClient:
    """Cached MongoClient – created once per process."""
    return MongoClient(settings.MONGO_URI)


def get_db() -> Database:
    """Return the application database."""
    return _get_client()[settings.DB_NAME]


def close_db() -> None:
    """Call on application shutdown to close the connection pool."""
    client = _get_client()
    client.close()
    _get_client.cache_clear()
