"""
app/api/router.py
Aggregates all route modules.
Add new routers here as the project grows.
"""
from fastapi import APIRouter

from app.api.routes import admin, authentication, batches, candidates

api_router = APIRouter(prefix="/api")
api_router.include_router(authentication.router)
api_router.include_router(admin.router)
api_router.include_router(batches.router)
api_router.include_router(candidates.router)

# Future additions, e.g.:
# from app.api.routes import audit_log
# api_router.include_router(audit_log.router)