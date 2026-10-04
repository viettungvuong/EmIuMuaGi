"""What every TikTok request shares: which links count as TikTok, and the
yt-dlp settings TikTok answers to."""

from urllib.parse import urlparse

from yt_dlp.networking.impersonate import ImpersonateTarget

# Shared by every TikTok request
TIKTOK_OPTS = {
    "quiet": True,
    "no_warnings": True,
    "noplaylist": True,
    # TikTok rejects yt-dlp's own requests and only answers ones that look like Chrome
    "impersonate": ImpersonateTarget("chrome"),
}


def is_tiktok(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host == "tiktok.com" or host.endswith(".tiktok.com")
