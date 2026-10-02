"""Look a place up on Google Maps by name and read its address off the page.
Maps builds the page with JavaScript, so this drives a headless Chromium
(Playwright – run `playwright install chromium` once)."""

import unicodedata
from dataclasses import dataclass
from urllib.parse import quote

import regex
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

_ADDRESS = '[data-item-id="address"] .Io6YTe'  # the address row of a place
_RESULT_LINK = "a.hfpxzc"  # an entry in a list of search results
_PLACE_NAME = "h1.DUwDvf"
_CATEGORY = "button.DkEaL"  # e.g. "Nhà hàng phở"

# Google always returns *something*, so a result only counts if its name has at
# least this share of the searched words ("Ốc Oanh" for "Quán Ốc Oanh")
_MIN_NAME_OVERLAP = 0.6


@dataclass
class MapsPlace:
    name: str
    address: str
    category: str | None


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


def _lookup(page, query: str) -> MapsPlace | None:
    # /maps/place/<name> only resolves exact place names and shows a blank
    # panel otherwise, so search instead and open the top result
    page.goto(
        "https://www.google.com/maps/search/" + "+".join(quote(w, safe="") for w in query.split()),
        wait_until="domcontentloaded",
    )
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


def find_on_maps(names: list[str], area: str | None = None) -> MapsPlace | None:
    """Search Maps for each name in turn and return the first place whose name
    matches. `area` (e.g. "District 1, Ho Chi Minh City") is added to every
    search to steer it towards the right city."""
    if not names:
        return None

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            context = browser.new_context(**p.devices["Desktop Chrome"], locale="vi-VN")
            page = context.new_page()
            for name in names:
                try:
                    place = _lookup(page, f"{name} {area}" if area else name)
                except PlaywrightError:
                    continue  # timed out or blocked; try the next name
                if place and _same_place(name, place.name):
                    return place
        finally:
            browser.close()
    return None
