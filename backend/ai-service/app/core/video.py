"""Download a TikTok video and read its caption with yt-dlp, then keep only
its last few seconds with ffmpeg (ffmpeg/ffprobe must be installed)."""

import subprocess
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from yt_dlp import YoutubeDL
from yt_dlp.networking.impersonate import ImpersonateTarget

SERVICE_ROOT = Path(__file__).resolve().parents[2]
DOWNLOAD_DIR = SERVICE_ROOT / "downloads"

# Videos longer than this are cut down to their last CLIP_SECONDS
CLIP_SECONDS = 6


@dataclass
class TikTokVideo:
    video_id: str
    caption: str | None  # the text the creator wrote under the video, hashtags included
    uploader: str | None
    duration: float  # seconds, of the full video
    trimmed: bool  # True when video_path is only the last CLIP_SECONDS
    video_path: str  # relative to the ai-service folder


def is_tiktok(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host == "tiktok.com" or host.endswith(".tiktok.com")


def _probe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    return float(out.strip())


def _trim_to_last(path: Path, seconds: int) -> Path:
    """Write the last `seconds` of `path` next to it as <name>_last<seconds>s.mp4,
    leaving the full download in place."""
    clip = path.with_name(f"{path.stem}_last{seconds}s.mp4")
    if clip.exists():
        return clip

    # Written under a temporary name so a failed run never looks finished
    tmp = clip.with_suffix(".mp4.part")
    # Re-encoded rather than stream-copied: copying can only cut on keyframes,
    # which would make the clip start up to a few seconds early
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-sseof", f"-{seconds}", "-i", str(path),
         "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-movflags", "+faststart",
         "-f", "mp4", str(tmp)],
        check=True,
    )
    tmp.replace(clip)
    return clip


def fetch_tiktok(url: str) -> TikTokVideo:
    """Download the video into downloads/<video_id>.mp4, trim it to its last
    CLIP_SECONDS if it is longer, and return its caption.
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

    # Measured from the file: TikTok's own duration is rounded to whole seconds
    duration = _probe_duration(filepath)
    trimmed = duration > CLIP_SECONDS
    if trimmed:
        filepath = _trim_to_last(filepath, CLIP_SECONDS)

    return TikTokVideo(
        video_id=info["id"],
        caption=info.get("description") or None,
        uploader=info.get("uploader"),
        duration=duration,
        trimmed=trimmed,
        video_path=str(filepath.relative_to(SERVICE_ROOT)),
    )
