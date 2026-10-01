from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from playwright.async_api import Error as PlaywrightError
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from pydantic import BaseModel, HttpUrl

from app.core.parsing import take_screenshot

router = APIRouter(prefix="/parse", tags=["parse"])


class ScreenshotRequest(BaseModel):
    url: HttpUrl
    full_page: bool = False


@router.post(
    "/screenshot",
    response_class=Response,
    responses={200: {"content": {"image/png": {}}, "description": "PNG screenshot of the page"}},
)
async def screenshot(req: ScreenshotRequest):
    try:
        png = await take_screenshot(str(req.url), full_page=req.full_page)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # TimeoutError is a subclass of Error, so it has to be caught first
    except PlaywrightTimeoutError:
        raise HTTPException(status_code=504, detail="Page took too long to load")
    except PlaywrightError as e:
        raise HTTPException(status_code=502, detail=f"Could not open page: {e.message.splitlines()[0]}")

    return Response(content=png, media_type="image/png")
