"""Pull item details straight out of a shop link, without opening the page."""

from dataclasses import dataclass
from urllib.parse import unquote, urlparse


@dataclass
class ParsedLink:
    source: str
    item_name: str | None = None
    shop_id: str | None = None
    item_id: str | None = None


def parse_shopee(url: str) -> ParsedLink | None:
    """Shopee product links look like
        https://shopee.vn/<title-slug>-i.<shop_id>.<item_id>?<tracking>
    where the slug is the product title, percent-encoded as UTF-8 with
    hyphens in place of spaces."""
    last_segment = urlparse(url).path.rstrip("/").split("/")[-1]

    # Split on the last "-i." so a title that happens to contain it stays intact
    slug, sep, ids = last_segment.rpartition("-i.")
    if not sep:
        return None

    shop_id, _, item_id = ids.partition(".")
    # Hyphens in the real title are lost here, they come back as spaces
    name = " ".join(unquote(slug).replace("-", " ").split())

    return ParsedLink(
        source="shopee",
        item_name=name or None,
        shop_id=shop_id or None,
        item_id=item_id or None,
    )


def parse_link(url: str) -> ParsedLink | None:
    """Return what can be read from `url`, or None if the site isn't supported yet."""
    host = (urlparse(url).hostname or "").lower()

    # shopee.vn, shopee.co.th, …
    if "shopee" in host.split("."):
        return parse_shopee(url)

    return None
