"""Read a place's address off Google Maps, either by searching its name or by
opening a Maps link someone shared – without a browser.

A Maps page is an empty shell that JavaScript fills in, so its HTML has no
address in it. But the HTML names the request that fetches the results
(<link href="/search?tbm=map…"> for a search, "/maps/preview/place…" for a
place), and that request answers with the data the page would have shown.
BeautifulSoup finds the link; the place is read out of the data."""

import json
import unicodedata
from dataclasses import dataclass
from urllib.parse import quote, urljoin, urlparse

import regex
from bs4 import BeautifulSoup
from curl_cffi import requests
from curl_cffi.requests.exceptions import RequestException

# google.com, google.com.vn, maps.google.co.uk… but not google.com.evil.io
_GOOGLE_HOST = regex.compile(r"^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$")

# What Google shows when it has no street address: a plus code like "FP84+82, Nha Bích"
_PLUS_CODE = regex.compile(r"^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3}\b")

# Google always returns *something*, so a result only counts if its name has at
# least this share of the searched words ("Ốc Oanh" for "Quán Ốc Oanh")
_MIN_NAME_OVERLAP = 0.6


class MapsLookupError(Exception):
    """Google didn't answer, or answered with something we can't read."""


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


def _get(url: str) -> requests.Response:
    # Looks like Chrome (Google answers plain scripts differently), in Vietnamese
    # so addresses come back as "Đ. Vĩnh Khánh" rather than "Vinh Khanh St"
    try:
        response = requests.get(
            url, impersonate="chrome", headers={"Accept-Language": "vi-VN,vi;q=0.9"}, timeout=15,
        )
        response.raise_for_status()
    except RequestException as e:
        raise MapsLookupError(f"Google Maps didn't answer: {e}") from e
    return response


def _places(data, depth: int = 0):
    """Every place record in Google's data, in order. A record is a long list
    with the name at [11], the category list at [13] and the address at [39]
    (the text the page shows in its address row)."""
    if not isinstance(data, list) or depth > 12:
        return
    if len(data) > 39 and isinstance(data[11], str) and isinstance(data[39], str):
        category = data[13][0] if isinstance(data[13], list) and data[13] else None
        yield MapsPlace(name=data[11], address=data[39], category=category)
        return
    for item in data:
        yield from _places(item, depth + 1)


def _read_place(page_url: str) -> MapsPlace | None:
    """The place a Maps page would show; for a list of results, the top one."""
    page = _get(page_url)  # follows maps.app.goo.gl redirects
    soup = BeautifulSoup(page.text, "html.parser")
    link = next(
        (l["href"] for l in soup.find_all("link", href=True) if "tbm=map" in l["href"] or "/maps/preview/place" in l["href"]),
        None,
    )
    if not link:
        raise MapsLookupError("Google Maps page has no results request (its layout may have changed)")

    body = _get(urljoin(page.url, link)).text
    try:
        data = json.loads(body.split("\n", 1)[1] if body.startswith(")]}'") else body)
    except ValueError as e:
        raise MapsLookupError("Google Maps sent results we can't read") from e

    # A city or area comes back without a category, and a place Google has no
    # street address for gives only a plus code; neither fills an address field
    return next((p for p in _places(data) if p.category and not _PLUS_CODE.match(p.address)), None)


def _search_url(query: str) -> str:
    # /maps/place/<name> only resolves exact place names, so search instead
    return "https://www.google.com/maps/search/" + "+".join(quote(w, safe="") for w in query.split())


def find_on_maps(names: list[str], area: str | None = None) -> MapsPlace | None:
    """Search Maps for each name in turn and return the first place whose name
    matches. `area` (e.g. "District 1, Ho Chi Minh City") is added to every
    search to steer it towards the right city."""
    for name in names:
        try:
            place = _read_place(_search_url(f"{name} {area}" if area else name))
        except MapsLookupError:
            continue  # timed out or blocked; try the next name
        if place and _same_place(name, place.name):
            return place
    return None


def read_maps_link(url: str) -> MapsPlace | None:
    """Open a Google Maps link someone shared and read the place off it.
    Raises ValueError for anything that isn't a Maps link, and MapsLookupError
    when Google doesn't answer usefully."""
    # Checked here so this never opens arbitrary URLs
    if not is_maps_link(url):
        raise ValueError("Not a Google Maps link")
    return _read_place(url)
