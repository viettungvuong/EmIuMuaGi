"""Download a TikTok video and read its caption with yt-dlp."""

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from yt_dlp import YoutubeDL
from yt_dlp.networking.impersonate import ImpersonateTarget

SERVICE_ROOT = Path(__file__).resolve().parents[2]
DOWNLOAD_DIR = SERVICE_ROOT / "downloads"


@dataclass
class TikTokVideo:
    video_id: str
    caption: str | None  # the text the creator wrote under the video, hashtags included
    uploader: str | None
    duration: float | None  # seconds
    video_path: str  # relative to the ai-service folder


def is_tiktok(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host == "tiktok.com" or host.endswith(".tiktok.com")


def fetch_tiktok(url: str) -> TikTokVideo:
    """Download the video into downloads/<video_id>.mp4 and return its caption.
    Raises ValueError for non-TikTok links and yt_dlp DownloadError when
    TikTok refuses (removed, private, region-blocked…)."""
    # Checked here so yt-dlp's generic extractor never fetches arbitrary URLs
    if not is_tiktok(url):
        raise ValueError("Only TikTok links are supported")

    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        # TikTok rejects yt-dlp's own requests and only answers ones that look like Chrome
        "impersonate": ImpersonateTarget("chrome"),
        # One file with sound so nothing needs merging, h264 so it plays anywhere
        "format": "best[vcodec^=h264]/best",
        "outtmpl": str(DOWNLOAD_DIR / "%(id)s.%(ext)s"),
    }
    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)

    filepath = Path(info["requested_downloads"][0]["filepath"])
    return TikTokVideo(
        video_id=info["id"],
        caption=info.get("description") or None,
        uploader=info.get("uploader"),
        duration=info.get("duration"),
        video_path=str(filepath.relative_to(SERVICE_ROOT)),
    )
