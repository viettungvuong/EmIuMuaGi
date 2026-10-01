from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl

from app.core.parsing import ParsedLink, parse_link

router = APIRouter(prefix="/parse", tags=["parse"])


class ParseRequest(BaseModel):
    url: HttpUrl


@router.post("", response_model=ParsedLink)
def parse(req: ParseRequest):
    parsed = parse_link(str(req.url))
    if parsed is None:
        raise HTTPException(status_code=422, detail="Can't read details from this link yet")
    return parsed
