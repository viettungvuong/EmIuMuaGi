from contextlib import suppress
from dataclasses import asdict
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.core.address import extract_address
from app.core.parsing import parse_link

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


@router.websocket("/ws/{item_uuid}")
async def parse_channel(ws: WebSocket, item_uuid: UUID):
    """Client sends {"seq": n, "url": "..."}; server answers
    {"seq": n, "url": "...", "result": {...} | null}. `seq` is echoed back so
    the client can ignore answers to links it has since replaced."""
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

            parsed = parse_link(url)
            await ws.send_json({
                "seq": msg.get("seq"),
                "url": url,
                "result": asdict(parsed) if parsed else None,
            })
    except WebSocketDisconnect:
        pass
    finally:
        # Only drop the channel if it hasn't already been taken over
        if channels.get(item_uuid) is ws:
            del channels[item_uuid]
