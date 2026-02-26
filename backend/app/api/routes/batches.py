"""
app/api/routes/batches.py
Batch management endpoints.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token
from app.models.batch import create_batch, get_all_batches, get_batch_by_id
from app.schemas.batch_schemas import BatchCreate, BatchOut

router = APIRouter(prefix="/batches", tags=["Batches"])
bearer = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")
    return payload


@router.post("", response_model=BatchOut, status_code=201)
def create(body: BatchCreate, user: dict = Depends(get_current_user)):
    """Create a new batch."""
    batch = create_batch(
        name=body.name,
        program=body.program,
        start_date=body.start_date,
        intake_size=body.intake_size,
        created_by=user["sub"],
        rules_config=body.rules_config,  # None → default applied in model
    )
    return BatchOut(**batch)


@router.get("", response_model=List[BatchOut])
def list_batches(user: dict = Depends(get_current_user)):
    """Get all batches for the current user."""
    batches = get_all_batches(created_by=user["sub"])
    return [BatchOut(**b) for b in batches]


@router.get("/{batch_id}", response_model=BatchOut)
def get_batch(batch_id: str, user: dict = Depends(get_current_user)):
    """Get a single batch by ID."""
    batch = get_batch_by_id(batch_id)
    if not batch or batch["created_by"] != user["sub"]:
        raise HTTPException(status_code=404, detail="Batch not found.")
    return BatchOut(**batch)