from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from yt_dlp.utils import DownloadError, ExtractorError

from app.core.location import TikTokLocation, get_tiktok_location

router = APIRouter(prefix="/api/video", tags=["video"])


class VideoRequest(BaseModel):
    url: HttpUrl


# Plain `def` on purpose: yt-dlp blocks, so FastAPI runs this in its threadpool
@router.post("/location", response_model=TikTokLocation)
def location(req: VideoRequest):
    """The video's location tag if it names a place, else an address from the
    caption, else the tag's area. Doesn't download the video."""
    try:
        return get_tiktok_location(str(req.url))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (DownloadError, ExtractorError) as e:
        raise HTTPException(status_code=502, detail=str(e).removeprefix("ERROR: "))
