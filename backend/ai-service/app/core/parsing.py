"""Pull item details straight out of a shop link, without opening the page."""

from dataclasses import dataclass
from urllib.parse import unquote, urlparse


@dataclass
class ParsedLink:
    source: str
    item_name: str | None = None
    shop_id: str | None = None
    item_id: str | None = None


def _last_segment(url: str) -> str:
    return urlparse(url).path.rstrip("/").split("/")[-1]


def _slug_to_name(slug: str) -> str | None:
    """'%C3%81o-thun-nam' -> 'Áo thun nam'. Hyphens in the real title are
    lost here, they come back as spaces."""
    return " ".join(unquote(slug).replace("-", " ").split()) or None


def parse_shopee(url: str) -> ParsedLink | None:
    """Shopee product links look like
        https://shopee.vn/<title-slug>-i.<shop_id>.<item_id>?<tracking>
    where the slug is the product title, percent-encoded as UTF-8 with
    hyphens in place of spaces."""
    # Split on the last "-i." so a title that happens to contain it stays intact
    slug, sep, ids = _last_segment(url).rpartition("-i.")
    if not sep:
        return None

    shop_id, _, item_id = ids.partition(".")
    return ParsedLink(
        source="shopee",
        item_name=_slug_to_name(slug),
        shop_id=shop_id or None,
        item_id=item_id or None,
    )


def parse_generic(url: str) -> ParsedLink | None:
    """Most shops end product links with the product name as a slug, e.g.
        https://remolacha.vn/products/lace-socks -> "lace socks" """
    name = _slug_to_name(_last_segment(url))
    if not name:
        return None

    host = (urlparse(url).hostname or "").lower()
    return ParsedLink(source=host.removeprefix("www."), item_name=name)


def parse_link(url: str) -> ParsedLink | None:
    """Return what can be read from `url`, or None if nothing can."""
    host = (urlparse(url).hostname or "").lower()

    # shopee.vn, shopee.co.th, …
    if "shopee" in host.split("."):
        return parse_shopee(url)

    return parse_generic(url)
