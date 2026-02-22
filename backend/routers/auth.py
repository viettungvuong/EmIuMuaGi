import os
from fastapi import APIRouter, HTTPException
from dotenv import load_dotenv
from schemas import AuthRequest, AuthResponse

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["auth"])

APP_PASSWORD = os.getenv("APP_PASSWORD", "secret123")


@router.post("/login", response_model=AuthResponse)
async def login(request: AuthRequest):
    if request.password == APP_PASSWORD:
        return AuthResponse(success=True, message="Authenticated successfully")
    raise HTTPException(status_code=401, detail="Invalid password")
