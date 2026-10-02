"""Where a TikTok video was filmed, from the creator's location tag (the green
📍 one) or, failing that, an address written in the caption."""

from dataclasses import dataclass

from yt_dlp import YoutubeDL
from yt_dlp.utils import ExtractorError

from app.core.address import extract_address
from app.core.video import TIKTOK_OPTS, is_tiktok

# Tags in this category are whole areas ("District 1", "Ho Chi Minh City"), not a place
_AREA_CATEGORY = "Place and Address"


@dataclass
class TikTokLocation:
    # "poi"      the location tag names a specific place
    # "caption"  an address found in the caption
    # "poi_area" the location tag only names an area, e.g. "District 1"
    # None       nothing found
    source: str | None
    address: str | None = None
    place_name: str | None = None  # e.g. "Bánh Mì Huynh Hoa - Lê Thị Riêng sandwich shop"
    place_type: str | None = None  # e.g. "Banh Mi Restaurant"


def _tiktok_video_data(url: str) -> dict:
    """TikTok's raw data for one video. yt-dlp downloads this but leaves the
    location tag out of what it returns, so this goes through its internal
    helper – a yt-dlp update could rename it."""
    with YoutubeDL(TIKTOK_OPTS) as ydl:
        ie = ydl.get_info_extractor("TikTok")
        if ydl.get_info_extractor("TikTokVM").suitable(url):
            # Share links (vt.tiktok.com/…) only redirect to the real video URL
            url = ydl.extract_info(url, download=False, process=False)["url"]

        match = ie._match_valid_url(url)
        if not match:
            raise ValueError("Not a TikTok video link")
        video_id, user_id = match.group("id", "user_id")
        data, status = ie._extract_web_data_and_status(ie._create_url(user_id, video_id), video_id)

    # Same status codes yt-dlp checks for
    if data and status == 0:
        return data
    if status in (10216, 10222):
        raise ExtractorError("This post or account is private", expected=True)
    if status == 10204:
        raise ExtractorError("Your IP address is blocked from accessing this post", expected=True)
    raise ExtractorError(f"Video not available, status code {status}", expected=True)


def get_tiktok_location(url: str) -> TikTokLocation:
    """A tag naming a specific place wins, then an address in the caption, then
    a tag that only names an area. Raises ValueError for non-TikTok links and
    yt_dlp ExtractorError/DownloadError when TikTok refuses."""
    if not is_tiktok(url):
        raise ValueError("Only TikTok links are supported")

    data = _tiktok_video_data(url)
    poi = data.get("poi") or {}
    is_area = poi.get("category") == _AREA_CATEGORY

    if poi and not is_area:
        return TikTokLocation(
            source="poi",
            address=poi.get("address") or None,
            place_name=poi.get("name") or None,
            place_type=poi.get("ttTypeNameTiny") or None,
        )

    address = extract_address(data.get("desc"))
    if address:
        return TikTokLocation(source="caption", address=address)

    if poi:
        # "District 1" + "Ho Chi Minh City, Vietnam"
        area = ", ".join(filter(None, [poi.get("name"), poi.get("address")]))
        return TikTokLocation(source="poi_area", address=area or None)

    return TikTokLocation(source=None)
