"""
app/schemas/candidate_schemas.py
Pydantic schemas for Candidate request bodies and responses.
The `data` field is intentionally open (Dict) to accommodate
all form fields added in later phases without schema changes.
"""
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class CandidateCreate(BaseModel):
    name:               str
    email:              str
    interview_status:   Optional[str]   = None
    screening_score:    Optional[float] = None
    offer_letter_sent:  Optional[bool]  = None
    exception_count:    int             = 0
    flagged:            bool            = False
    data:               Dict[str, Any]  = Field(default_factory=dict)


class CandidateOut(BaseModel):
    id:                 str
    batch_id:           str
    name:               str
    email:              str
    interview_status:   Optional[str]   = None
    screening_score:    Optional[float] = None
    offer_letter_sent:  Optional[bool]  = None
    exception_count:    int             = 0
    flagged:            bool            = False
    data:               Dict[str, Any]  = Field(default_factory=dict)
    created_at:         Optional[str]   = None
    updated_at:         Optional[str]   = None

class ReviewRequest(BaseModel):
    review_status: str = Field(..., pattern="^(accepted|rejected)$")
    review_note:   Optional[str] = None