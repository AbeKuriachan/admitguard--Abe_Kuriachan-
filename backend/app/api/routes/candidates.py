"""
app/api/routes/candidates.py
Candidate endpoints scoped under a batch.
GET   /api/batches/{batch_id}/candidates
GET   /api/batches/{batch_id}/candidates/{candidate_id}
POST  /api/batches/{batch_id}/candidates
PUT   /api/batches/{batch_id}/candidates/{candidate_id}
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token
from app.models.batch import get_batch_by_id
from app.models.candidate import (
    create_candidate,
    get_candidates_by_batch,
    get_candidate_by_id,
    update_candidate,
)
from app.schemas.candidate_schemas import CandidateCreate, CandidateOut

router = APIRouter(prefix="/batches/{batch_id}/candidates", tags=["Candidates"])
bearer = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")
    return payload


def verify_batch_access(batch_id: str, user: dict) -> dict:
    batch = get_batch_by_id(batch_id)
    if not batch or batch["created_by"] != user["sub"]:
        raise HTTPException(status_code=404, detail="Batch not found.")
    return batch


# ── GET all candidates ────────────────────────────────────────────────────────
@router.get("", response_model=List[CandidateOut])
def list_candidates(batch_id: str, user: dict = Depends(get_current_user)):
    verify_batch_access(batch_id, user)
    return [CandidateOut(**c) for c in get_candidates_by_batch(batch_id)]


# ── GET single candidate ──────────────────────────────────────────────────────
@router.get("/{candidate_id}", response_model=CandidateOut)
def get_candidate(batch_id: str, candidate_id: str, user: dict = Depends(get_current_user)):
    verify_batch_access(batch_id, user)
    candidate = get_candidate_by_id(candidate_id)
    if not candidate or candidate["batch_id"] != batch_id:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    return CandidateOut(**candidate)


# ── POST create candidate ─────────────────────────────────────────────────────
@router.post("", response_model=CandidateOut, status_code=201)
def create(batch_id: str, body: CandidateCreate, user: dict = Depends(get_current_user)):
    verify_batch_access(batch_id, user)

    # Server-side: block if interview_status is Rejected
    if body.interview_status == "Rejected":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Candidate is Rejected. Submission blocked."
        )

    candidate = create_candidate(
        batch_id=batch_id,
        name=body.name,
        email=body.email,
        interview_status=body.interview_status,
        screening_score=body.screening_score,
        offer_letter_sent=body.offer_letter_sent,
        exception_count=body.exception_count,
        flagged=body.flagged,
        data=body.data,
    )
    return CandidateOut(**candidate)


# ── PUT update candidate ──────────────────────────────────────────────────────
@router.put("/{candidate_id}", response_model=CandidateOut)
def update(
    batch_id: str,
    candidate_id: str,
    body: CandidateCreate,
    user: dict = Depends(get_current_user),
):
    verify_batch_access(batch_id, user)

    candidate = get_candidate_by_id(candidate_id)
    if not candidate or candidate["batch_id"] != batch_id:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    if body.interview_status == "Rejected":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Candidate is Rejected. Submission blocked."
        )

    updated = update_candidate(candidate_id, {
        "name":               body.name,
        "email":              body.email,
        "interview_status":   body.interview_status,
        "screening_score":    body.screening_score,
        "offer_letter_sent":  body.offer_letter_sent,
        "exception_count":    body.exception_count,
        "flagged":            body.flagged,
        "data":               body.data,
    })
    return CandidateOut(**updated)