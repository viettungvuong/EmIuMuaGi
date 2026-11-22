"""Pull item details out of a shop link: the name straight from the link itself
(parse_link), and the price off the shop's page, which takes opening it
(read_prices – Shopee only, so far)."""

import logging
import os
import threading
import time
from collections import defaultdict
from dataclasses import dataclass
from urllib.parse import unquote, urlparse

import regex
from bs4 import BeautifulSoup
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

log = logging.getLogger(__name__)


@dataclass
class ParsedLink:
    source: str
    item_name: str | None = None
    shop_id: str | None = None
    item_id: str | None = None


# shopee.vn and the other countries' shops, with any subdomain (s.shopee.vn share
# links), plus the shp.ee short links – but not shopee.vn.evil.io
_SHOPEE_HOST = regex.compile(
    r"^(?:[a-z0-9-]+\.)*"
    r"(?:shopee\.(?:vn|sg|ph|tw|cl|co\.th|co\.id|com\.my|com\.br|com\.mx|com\.co)|shp\.ee)$"
)


def is_shopee_link(url: str) -> bool:
    parts = urlparse(url.strip())
    return parts.scheme in ("http", "https") and bool(_SHOPEE_HOST.match((parts.hostname or "").lower()))


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
    parts = urlparse(url.strip())
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return None

    if is_shopee_link(url):
        return parse_shopee(url)

    return parse_generic(url)


# --- Prices -----------------------------------------------------------------
#
# The item service asks for these when someone signs in (never while the list
# loads), with every link on the couple's list still to buy. The links are
# sorted and divided into categories by site, and each category that has a
# price reader is read in one go: all of Shopee's pages in one browser.


@dataclass
class PriceLink:
    id: int  # the item's
    url: str


def link_category(url: str) -> str:
    """'shopee' for a Shopee link, else the site ('remolacha.vn')"""
    if is_shopee_link(url):
        return "shopee"
    return (urlparse(url.strip()).hostname or "").lower().removeprefix("www.") or "unknown"


def categorize_links(links: list[PriceLink]) -> dict[str, list[PriceLink]]:
    """The links as {category: links}. They're sorted by link first, so each
    category's links come out in link order and a link two items share sits
    next to itself and is opened only once."""
    categories: dict[str, list[PriceLink]] = defaultdict(list)
    for link in sorted(links, key=lambda link: link.url):
        categories[link_category(link.url)].append(link)
    return dict(categories)


# Shopee draws the price with JavaScript, into this div. Its class names are
# generated when Shopee builds its site and change when they redeploy:
# SHOPEE_PRICE_SELECTOR overrides this one, without a code change, when that happens.
DEFAULT_SHOPEE_PRICE_SELECTOR = "div.pyzxvq.pw3J3G"


def shopee_price_selector() -> str:
    return os.getenv("SHOPEE_PRICE_SELECTOR") or DEFAULT_SHOPEE_PRICE_SELECTOR


def extract_shopee_price(html: str, selector: str | None = None) -> str | None:
    """The price as the page shows it – '₫129.000', or a range such as
    '₫99.000 - ₫159.000' – from a product page's HTML once it has been drawn"""
    div = BeautifulSoup(html, "html.parser").select_one(selector or shopee_price_selector())
    if div is None:
        return None
    text = " ".join(div.get_text(" ").split())
    return regex.sub(r"₫\s+", "₫", text) or None


# Shopee only shows a product to a signed-in browser; anyone else is sent here
_SHOPEE_BLOCKED_PATHS = ("/verify/", "/buyer/login")

# The signed-in shopee.vn browser's cookies, as the Cookie header copied from a
# logged-in tab (devtools > Network > any shopee.vn request > Request Headers >
# cookie): "SPC_EC=…; SPC_U=…; …". It's a shopee.vn account, so they're for
# shopee.vn and its subdomains.
_SHOPEE_COOKIE_DOMAIN = ".shopee.vn"

_PAGE_TIMEOUT_MS = 30_000  # for the page to load
_PRICE_WAIT_S = 15  # then for its price to be drawn
_SHOPEE_BUDGET_S = 600  # whatever isn't read by then waits for the next sign-in

# One browser at a time: each takes a few hundred MB
_browser_lock = threading.Lock()


class ShopeeBlocked(Exception):
    """Shopee sent the browser to its sign-in / bot check: SHOPEE_COOKIES is
    missing or has expired."""


def _shopee_cookies() -> list[dict]:
    cookies = []
    for part in os.getenv("SHOPEE_COOKIES", "").split(";"):
        name, sep, value = part.strip().partition("=")
        if sep and name:
            cookies.append({"name": name, "value": value, "domain": _SHOPEE_COOKIE_DOMAIN, "path": "/"})
    return cookies


def _is_blocked(url: str) -> bool:
    return urlparse(url).path.startswith(_SHOPEE_BLOCKED_PATHS)


def _read_shopee_page(page, url: str) -> str | None:
    """The price on the product page at `url`, or None if it has none (the
    product is gone, or Shopee's class names changed)"""
    page.goto(url, wait_until="domcontentloaded", timeout=_PAGE_TIMEOUT_MS)
    selector = shopee_price_selector()

    # Until the price is drawn, or Shopee turns the browser away (that comes a
    # moment after loading, so it's watched for too)
    give_up = time.monotonic() + _PRICE_WAIT_S
    while time.monotonic() < give_up:
        if _is_blocked(page.url):
            raise ShopeeBlocked(page.url)
        if page.query_selector(selector):
            break
        page.wait_for_timeout(250)

    return extract_shopee_price(page.content(), selector)


def read_shopee_prices(links: list[PriceLink]) -> dict[int, str | None]:
    """{item id: price, or None if its page had none} for the Shopee links, read
    one after another in one browser, in the order given. A link whose page
    didn't load, or wasn't reached, is left out, to be tried at the next sign-in."""
    results: dict[int, str | None] = {}
    by_url: dict[str, str | None] = {}  # a link two items share is opened once
    give_up = time.monotonic() + _SHOPEE_BUDGET_S

    with _browser_lock, sync_playwright() as p:
        # Desktop rather than mobile: on phones Shopee covers the page with
        # "open in app" popups
        browser = p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        try:
            context = browser.new_context(**p.devices["Desktop Chrome"], locale="vi-VN")
            context.add_cookies(_shopee_cookies())
            page = context.new_page()

            for link in links:
                if link.url not in by_url:
                    if time.monotonic() > give_up:
                        log.info("shopee: out of time, %d link(s) wait for the next sign-in", len(links) - len(results))
                        break
                    try:
                        by_url[link.url] = _read_shopee_page(page, link.url)
                    except ShopeeBlocked:
                        log.warning("shopee: asked to sign in – set SHOPEE_COOKIES (missing or expired); "
                                    "%d price(s) not read", len(links) - len(results))
                        break
                    except PlaywrightError as e:
                        log.info("shopee: %s didn't load: %s", link.url, str(e).splitlines()[0])
                        continue
                    log.info("shopee: %s -> %s", link.url, by_url[link.url])
                results[link.id] = by_url[link.url]
        finally:
            browser.close()

    return results


# Which categories have a price reader. The rest are left alone.
PRICE_READERS = {
    "shopee": read_shopee_prices,
}


def read_prices(links: list[PriceLink]) -> dict[int, str | None]:
    """{item id: price, or None if its page had none} for the links whose page
    was read; links of sites without a reader aren't in it"""
    results: dict[int, str | None] = {}
    for category, group in categorize_links(links).items():
        reader = PRICE_READERS.get(category)
        if reader is None:
            continue
        log.info("prices: reading %d %s link(s)", len(group), category)
        results.update(reader(group))
    return results
