import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from contextlib import suppress
from dataclasses import asdict
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from playwright.sync_api import Error as PlaywrightError
from pydantic import BaseModel, Field
from yt_dlp.utils import DownloadError, ExtractorError

from app.core.address import extract_address
from app.core.location import get_tiktok_location
from app.core.maps import is_maps_link, read_maps_link
from app.core.parsing import parse_link
from app.core.video import is_tiktok

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/parse", tags=["parse"])


class AddressRequest(BaseModel):
    text: str = Field(max_length=10_000)  # TikTok captions top out around 4,000 chars


class AddressResponse(BaseModel):
    address: str | None


@router.post("/address", response_model=AddressResponse)
def address(req: AddressRequest):
    """First "265/234 Trường Chinh"-style address in `text`, or null."""
    return AddressResponse(address=extract_address(req.text))

# One live socket per item being added, keyed by the uuid the frontend
# generated for it (the same uuid the item is saved with)
channels: dict[UUID, WebSocket] = {}

# TikTok and Google Maps lookups block for seconds (yt-dlp, a headless
# browser), so each runs on a pool thread and answers when it's done while the
# socket keeps reading. Capped because every Maps page starts a Chromium.
_lookup_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="slow-lookup")
# Running lookups, held so they aren't garbage-collected before they answer
_lookups: set[asyncio.Task] = set()


def _tiktok_lookup(url: str) -> dict:
    return asdict(get_tiktok_location(url))


def _maps_lookup(url: str) -> dict | None:
    place = read_maps_link(url)
    if not place:
        return None
    # Same shape as a TikTok answer, so the page fills the same fields
    return {"source": "maps_link", "address": place.address, "place_name": place.name, "place_type": place.category}


async def _send(item_uuid: UUID, payload: dict) -> None:
    """Send to whichever socket holds the item's channel *now*: during a slow
    lookup it may have been replaced (a reconnect) or closed (item saved)."""
    ws = channels.get(item_uuid)
    if ws is None:
        return
    # Closed between the lookup finishing and this send; nobody to tell
    with suppress(WebSocketDisconnect, RuntimeError, OSError):
        await ws.send_json(payload)


async def _answer_later(item_uuid: UUID, seq, url: str, kind: str, lookup) -> None:
    reply = {"seq": seq, "url": url, "type": kind, "result": None}
    try:
        reply["result"] = await asyncio.get_running_loop().run_in_executor(_lookup_pool, lookup, url)
    except (ValueError, ExtractorError, DownloadError, PlaywrightError) as e:
        # Not a video, private, blocked, page didn't load…
        reply["error"] = str(e).removeprefix("ERROR: ").splitlines()[0]
    except Exception:
        log.exception("%s lookup failed for %s", kind, url)
        reply["error"] = "Lookup failed"
    await _send(item_uuid, reply)


@router.websocket("/ws/{item_uuid}")
async def parse_channel(ws: WebSocket, item_uuid: UUID):
    """Client sends {"seq": n, "url": "..."}; server answers
    {"seq": n, "url": "...", "type": "link" | "tiktok" | "maps", "result": {...} | null}.

    - "link":   instant, read from the URL itself (parse_link)
    - "tiktok": a few seconds later, where the video was filmed
                (get_tiktok_location)
    - "maps":   a few seconds later, the place a Google Maps link points to
                (read_maps_link), with the same fields as "tiktok"
    The slow two may carry "error" instead of a result.

    `seq` is echoed back so the client can ignore answers to links it has since
    replaced, which matters now that TikTok answers arrive out of order."""
    await ws.accept()

    # A newer connection for the same item (e.g. a reload) takes over the channel
    old = channels.get(item_uuid)
    if old is not None:
        with suppress(RuntimeError):
            await old.close()
    channels[item_uuid] = ws

    try:
        while True:
            try:
                msg = await ws.receive_json()
                url = str(msg["url"])
            except (ValueError, KeyError, TypeError):
                await ws.send_json({"error": 'Expected {"seq": n, "url": "..."}'})
                continue

            seq = msg.get("seq")
            if is_tiktok(url):
                slow = ("tiktok", _tiktok_lookup)
            elif is_maps_link(url):
                slow = ("maps", _maps_lookup)
            else:
                slow = None
            if slow:
                task = asyncio.create_task(_answer_later(item_uuid, seq, url, *slow))
                _lookups.add(task)
                task.add_done_callback(_lookups.discard)
                continue

            parsed = parse_link(url)
            await ws.send_json({
                "seq": seq,
                "url": url,
                "type": "link",
                "result": asdict(parsed) if parsed else None,
            })
    except WebSocketDisconnect:
        pass
    finally:
        # Only drop the channel if it hasn't already been taken over
        if channels.get(item_uuid) is ws:
            del channels[item_uuid]
