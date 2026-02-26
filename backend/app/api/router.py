"""
app/api/router.py
Aggregates all route modules.
Add new routers here as the project grows.
"""
from fastapi import APIRouter

from app.api.routes import authentication, batches

api_router = APIRouter(prefix="/api")
api_router.include_router(authentication.router)
api_router.include_router(batches.router)

# Future additions, e.g.:
# from app.api.routes import candidates, audit_log
# api_router.include_router(candidates.router)
# api_router.include_router(audit_log.router)