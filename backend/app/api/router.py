"""
app/api/router.py
Aggregates all route modules.
Add new routers here as the project grows.
"""
from fastapi import APIRouter

from app.api.routes import authentication

api_router = APIRouter(prefix="/api")
api_router.include_router(authentication.router)

# Future additions, e.g.:
# from app.api.routes import students, admissions
# api_router.include_router(students.router)
# api_router.include_router(admissions.router)
