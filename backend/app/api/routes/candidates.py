"""
app/api/routes/candidates.py
Candidate endpoints scoped under a batch.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token
from app.models.batch import get_batch_by_id
from app.models.candidate import (
    create_candidate, get_candidates_by_batch,
    get_candidate_by_id, update_candidate,
)
from app.schemas.candidate_schemas import CandidateCreate, CandidateOut, ReviewRequest

router = APIRouter(prefix="/batches/{batch_id}/candidates", tags=["Candidates"])
bearer = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")
    return payload


def verify_batch(batch_id: str) -> dict:
    """Ensure the batch exists (shared workspace — no ownership check)."""
    batch = get_batch_by_id(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")
    return batch


# ── GET all ───────────────────────────────────────────────────────────────────
@router.get("", response_model=List[CandidateOut])
def list_candidates(batch_id: str, user: dict = Depends(get_current_user)):
    verify_batch(batch_id)
    return [CandidateOut(**c) for c in get_candidates_by_batch(batch_id)]


# ── GET one ───────────────────────────────────────────────────────────────────
@router.get("/{candidate_id}", response_model=CandidateOut)
def get_candidate(batch_id: str, candidate_id: str, user: dict = Depends(get_current_user)):
    verify_batch(batch_id)
    c = get_candidate_by_id(candidate_id)
    if not c or c["batch_id"] != batch_id:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    return CandidateOut(**c)


# ── POST create ───────────────────────────────────────────────────────────────
@router.post("", response_model=CandidateOut, status_code=201)
def create(batch_id: str, body: CandidateCreate, user: dict = Depends(get_current_user)):
    verify_batch(batch_id)
    if body.interview_status == "Rejected":
        raise HTTPException(status_code=422, detail="Candidate is Rejected. Submission blocked.")
    c = create_candidate(
        batch_id=batch_id,
        name=body.name, email=body.email,
        interview_status=body.interview_status,
        screening_score=body.screening_score,
        offer_letter_sent=body.offer_letter_sent,
        exception_count=body.exception_count,
        flagged=body.flagged,
        data=body.data,
    )
    return CandidateOut(**c)


# ── PUT update ────────────────────────────────────────────────────────────────
@router.put("/{candidate_id}", response_model=CandidateOut)
def update(batch_id: str, candidate_id: str, body: CandidateCreate, user: dict = Depends(get_current_user)):
    verify_batch(batch_id)
    c = get_candidate_by_id(candidate_id)
    if not c or c["batch_id"] != batch_id:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    if body.interview_status == "Rejected":
        raise HTTPException(status_code=422, detail="Candidate is Rejected. Submission blocked.")
    updated = update_candidate(candidate_id, {
        "name": body.name, "email": body.email,
        "interview_status": body.interview_status,
        "screening_score": body.screening_score,
        "offer_letter_sent": body.offer_letter_sent,
        "exception_count": body.exception_count,
        "flagged": body.flagged,
        "data": body.data,
    })
    return CandidateOut(**updated)


# ── PATCH review ──────────────────────────────────────────────────────────────
@router.patch("/{candidate_id}/review", response_model=CandidateOut)
def review(batch_id: str, candidate_id: str, body: ReviewRequest, user: dict = Depends(get_current_user)):
    """Admin or Manager only: accept or reject a flagged candidate."""
    role = user.get("role", "user")
    if role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Only admin or manager can review candidates.")
    verify_batch(batch_id)
    c = get_candidate_by_id(candidate_id)
    if not c or c["batch_id"] != batch_id:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    updated = update_candidate(candidate_id, {
        "review_status": body.review_status,
        "reviewed_by":   user.get("email", user.get("sub")),
        "review_note":   body.review_note,
    })
    return CandidateOut(**updated)