from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from yt_dlp.utils import DownloadError

from app.core.video import TikTokVideo, fetch_tiktok

router = APIRouter(prefix="/api/video", tags=["video"])


class VideoRequest(BaseModel):
    url: HttpUrl


# Plain `def` on purpose: yt-dlp blocks, so FastAPI runs this in its threadpool
@router.post("/tiktok", response_model=TikTokVideo)
def tiktok(req: VideoRequest):
    try:
        return fetch_tiktok(str(req.url))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except DownloadError as e:
        raise HTTPException(status_code=502, detail=str(e).removeprefix("ERROR: "))
