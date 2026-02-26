"""
app/main.py
FastAPI application factory.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.db.mongo import close_db


def create_app() -> FastAPI:
    app = FastAPI(title="AdmitGuard API", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)

    @app.on_event("shutdown")
    def on_shutdown():
        close_db()

    @app.get("/", tags=["Health"])
    def health():
        return {"status": "ok", "service": "AdmitGuard API"}

    return app


app = create_app()
