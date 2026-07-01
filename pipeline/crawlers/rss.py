import httpx
from xml.etree import ElementTree
from datetime import datetime
from .base import RawArticle

RSS_FEEDS = [
    ('https://www.mk.co.kr/rss/30000001/', 'mk'),
    ('https://biz.chosun.com/site/data/rss/realestate.xml', 'chosun'),
]


async def fetch_rss(config) -> list[RawArticle]:
    results = []
    async with httpx.AsyncClient(timeout=10) as client:
        for url, source in RSS_FEEDS:
            try:
                res = await client.get(url)
                root = ElementTree.fromstring(res.text)
                for item in root.findall('.//item')[:10]:
                    title = item.findtext('title', '').strip()
                    link = item.findtext('link', '').strip()
                    desc = item.findtext('description', '').strip()
                    try:
                        pub = datetime.strptime(item.findtext('pubDate', ''), '%a, %d %b %Y %H:%M:%S +0900')
                    except ValueError:
                        pub = datetime.now()
                    results.append(RawArticle(source=source, title=title, url=link,
                        content=desc[:2000], published_at=pub))
            except Exception:
                pass
    return results
