"""Open an item's link in a headless browser and capture how the page looks,
so its details (name, price, address…) can be inferred from it later."""

from urllib.parse import urlparse

from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright

# Desktop rather than mobile: on phones, Google Maps / Shopee / Facebook cover
# the page with "open in app" popups that hide the content we want
DEVICE = "Desktop Chrome"


async def take_screenshot(url: str, full_page: bool = False, timeout_ms: int = 20_000) -> bytes:
    """Return a PNG screenshot of the page at `url`."""
    if urlparse(url).scheme not in ("http", "https"):
        raise ValueError(f"Only http(s) links can be opened: {url}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context(**p.devices[DEVICE], locale="vi-VN")
            page = await context.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)

            # Give lazy-loaded images and prices a moment, without hanging on
            # pages that keep polling and never go fully idle
            try:
                await page.wait_for_load_state("networkidle", timeout=5_000)
            except PlaywrightTimeoutError:
                pass

            return await page.screenshot(full_page=full_page, type="png")
        finally:
            await browser.close()
