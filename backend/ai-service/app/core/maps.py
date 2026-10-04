"""Read a place's address off Google Maps, either by searching its name or by
opening a Maps link someone shared. Maps builds the page with JavaScript, so
this drives a headless Chromium (Playwright – run `playwright install chromium` once)."""

import unicodedata
from contextlib import contextmanager
from dataclasses import dataclass
from urllib.parse import quote, urlparse

import regex
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

# A place panel lists its address, website, phone and plus code, each in a
# div.Io6YTe; the address is the one inside the row marked data-item-id="address"
_ADDRESS = '[data-item-id="address"] div.Io6YTe'
_RESULT_LINK = "a.hfpxzc"  # an entry in a list of search results
_PLACE_NAME = "h1.DUwDvf"
_CATEGORY = "button.DkEaL"  # e.g. "Nhà hàng phở"

# google.com, google.com.vn, maps.google.co.uk… but not google.com.evil.io
_GOOGLE_HOST = regex.compile(r"^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$")

# Google always returns *something*, so a result only counts if its name has at
# least this share of the searched words ("Ốc Oanh" for "Quán Ốc Oanh")
_MIN_NAME_OVERLAP = 0.6


@dataclass
class MapsPlace:
    name: str
    address: str
    category: str | None


def is_maps_link(url: str) -> bool:
    """A Google Maps page, or a share link (maps.app.goo.gl/…) that redirects to one."""
    parts = urlparse(url)
    host = (parts.hostname or "").lower()
    if parts.scheme not in ("http", "https"):
        return False
    if host == "maps.app.goo.gl":
        return len(parts.path) > 1
    if host == "goo.gl":
        return parts.path.startswith("/maps")
    if not _GOOGLE_HOST.match(host):
        return False
    return host.startswith("maps.") or parts.path.startswith("/maps")


def _words(text: str) -> set[str]:
    """Lowercase words without accents, so "Huỳnh" and "Huynh" match."""
    text = unicodedata.normalize("NFD", text.replace("đ", "d").replace("Đ", "D"))
    text = "".join(c for c in text if not unicodedata.combining(c))
    return set(regex.findall(r"\w+", text.lower()))


def _same_place(searched: str, found: str) -> bool:
    wanted = _words(searched)
    return bool(wanted) and len(wanted & _words(found)) / len(wanted) >= _MIN_NAME_OVERLAP


def _text(page, selector: str) -> str | None:
    el = page.query_selector(selector)
    return el.inner_text().strip() if el else None


@contextmanager
def _maps_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            context = browser.new_context(**p.devices["Desktop Chrome"], locale="vi-VN")
            yield context.new_page()
        finally:
            browser.close()


def _read_place(page) -> MapsPlace | None:
    """The place on the page just loaded. A list of results (several matches)
    is narrowed to its top entry first."""
    page.wait_for_selector(f"{_ADDRESS}, {_RESULT_LINK}, {_PLACE_NAME}", timeout=10_000)

    if not page.query_selector(_ADDRESS):
        # Several matches: a list. One match: the place itself, still loading
        first = page.query_selector(_RESULT_LINK)
        if first:
            first.click()
        try:
            page.wait_for_selector(_ADDRESS, timeout=5_000)
        except PlaywrightTimeoutError:
            return None  # e.g. a city, which has no street address

    name, address = _text(page, _PLACE_NAME), _text(page, _ADDRESS)
    if not name or not address:
        return None
    return MapsPlace(name=name, address=address, category=_text(page, _CATEGORY))


def _lookup(page, query: str) -> MapsPlace | None:
    # /maps/place/<name> only resolves exact place names and shows a blank
    # panel otherwise, so search instead
    page.goto(
        "https://www.google.com/maps/search/" + "+".join(quote(w, safe="") for w in query.split()),
        wait_until="domcontentloaded",
    )
    return _read_place(page)


def find_on_maps(names: list[str], area: str | None = None) -> MapsPlace | None:
    """Search Maps for each name in turn and return the first place whose name
    matches. `area` (e.g. "District 1, Ho Chi Minh City") is added to every
    search to steer it towards the right city."""
    if not names:
        return None

    with _maps_page() as page:
        for name in names:
            try:
                place = _lookup(page, f"{name} {area}" if area else name)
            except PlaywrightError:
                continue  # timed out or blocked; try the next name
            if place and _same_place(name, place.name):
                return place
    return None


def read_maps_link(url: str) -> MapsPlace | None:
    """Open a Google Maps link someone shared and read the place off it.
    Raises ValueError for anything that isn't a Maps link, and Playwright's
    Error when the page doesn't load."""
    # Checked here so this never opens arbitrary URLs
    if not is_maps_link(url):
        raise ValueError("Not a Google Maps link")

    with _maps_page() as page:
        page.goto(url, wait_until="domcontentloaded")  # follows maps.app.goo.gl redirects
        return _read_place(page)
