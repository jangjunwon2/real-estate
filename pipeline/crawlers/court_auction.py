from datetime import datetime
from playwright.async_api import async_playwright
from .base import RawArticle

try:
    from playwright_stealth import stealth_async
    HAS_STEALTH = True
except ImportError:
    HAS_STEALTH = False


async def fetch_court_auctions(config) -> list[RawArticle]:
    results = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page = await browser.new_page()
        if HAS_STEALTH:
            await stealth_async(page)
        try:
            await page.goto(
                'https://www.courtauction.go.kr/RetrieveRealEstList.laf',
                wait_until='networkidle', timeout=30000,
            )
            await page.wait_for_selector('table', timeout=10000)
            for row in (await page.query_selector_all('table tbody tr'))[:10]:
                cells = await row.query_selector_all('td')
                if len(cells) < 5:
                    continue
                texts = [await c.inner_text() for c in cells]
                title = f'[경매] {texts[2].strip()} 최저가 {texts[4].strip()}'
                url = 'https://www.courtauction.go.kr'
                link = await row.query_selector('a')
                if link:
                    href = await link.get_attribute('href')
                    if href:
                        url = f'https://www.courtauction.go.kr{href}'
                results.append(RawArticle(
                    source='court_auction', title=title,
                    url=url, content=title, published_at=datetime.now(),
                ))
        except Exception:
            pass
        finally:
            await browser.close()
    return results
