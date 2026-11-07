import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from yt_dlp.utils import DownloadError, ExtractorError

from app.core.location import TikTokLocation, get_tiktok_location

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/video", tags=["video"])


class VideoRequest(BaseModel):
    url: HttpUrl


# Plain `def` on purpose: yt-dlp blocks, so FastAPI runs this in its threadpool
@router.post("/location", response_model=TikTokLocation)
def location(req: VideoRequest):
    """The video's location tag if it names a place, else an address from the
    caption, else the tag's area. Doesn't download the video."""
    try:
        found = get_tiktok_location(str(req.url))
    except ValueError as e:
        log.warning("location %s: %s", req.url, e)
        raise HTTPException(status_code=400, detail=str(e))
    except (DownloadError, ExtractorError) as e:
        log.warning("location %s: lookup failed: %s", req.url, e)
        raise HTTPException(status_code=502, detail=str(e).removeprefix("ERROR: "))
    log.info("location %s -> %s", req.url, found)
    return found
