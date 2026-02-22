from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Item(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    created_at: datetime


class ItemCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class AuthRequest(BaseModel):
    password: str


class AuthResponse(BaseModel):
    success: bool
    message: str
