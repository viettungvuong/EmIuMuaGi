import os
import base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
from fastapi import APIRouter, HTTPException
from dotenv import load_dotenv
from schemas import AuthRequest, AuthResponse

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["auth"])

APP_PASSWORD = os.getenv("APP_PASSWORD", "secret123")
AES_KEY = b'1234567890123456'
AES_IV = b'1234567890123456'

def decrypt_password(enc_b64: str) -> str:
    try:
        enc_bytes = base64.b64decode(enc_b64)
        cipher = AES.new(AES_KEY, AES.MODE_CBC, AES_IV)
        decrypted_bytes = unpad(cipher.decrypt(enc_bytes), AES.block_size)
        return decrypted_bytes.decode('utf-8')
    except Exception:
        return ""


@router.post("/login", response_model=AuthResponse)
async def login(request: AuthRequest):
    decrypted_pass = decrypt_password(request.password)
    if request.password == APP_PASSWORD or decrypted_pass == APP_PASSWORD:
        return AuthResponse(success=True, message="Authenticated successfully")
    raise HTTPException(status_code=401, detail="Invalid password")
