import html as htmllib
import httpx
from datetime import datetime
from .base import RawArticle

KEYWORDS = ['생애최초 대출', '아파트 매매', '청약', '금리 인상', '재건축', '취득세', '전세']


def _clean(text: str) -> str:
    text = text.replace('<b>', '').replace('</b>', '')
    return htmllib.unescape(text)


async def fetch_naver_news(config) -> list[RawArticle]:
    results = []
    async with httpx.AsyncClient(timeout=10) as client:
        for keyword in KEYWORDS:
            try:
                res = await client.get(
                    'https://openapi.naver.com/v1/search/news.json',
                    params={'query': keyword, 'display': 10, 'sort': 'date'},
                    headers={
                        'X-Naver-Client-Id': config.naver_client_id,
                        'X-Naver-Client-Secret': config.naver_client_secret,
                    },
                )
                res.raise_for_status()
                for item in res.json().get('items', []):
                    results.append(RawArticle(
                        source='naver',
                        title=_clean(item['title']),
                        url=item['originallink'] or item['link'],
                        content=_clean(item['description']),
                        published_at=datetime.strptime(item['pubDate'], '%a, %d %b %Y %H:%M:%S +0900'),
                    ))
            except Exception:
                pass
    return results
