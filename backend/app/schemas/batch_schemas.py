"""
app/schemas/batch_schemas.py
Pydantic schemas for Batch request bodies and responses.
"""
from pydantic import BaseModel, Field


class BatchCreate(BaseModel):
    name:        str = Field(..., min_length=1, max_length=120)
    program:     str = Field(..., min_length=1, max_length=120)
    start_date:  str = Field(..., description="ISO date string e.g. 2026-07-01")
    intake_size: int = Field(..., ge=1)


class BatchOut(BaseModel):
    id:          str
    name:        str
    program:     str
    start_date:  str
    intake_size: int
    created_by:  str