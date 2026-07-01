import httpx
from datetime import datetime
from .base import RawArticle


async def fetch_onbid(config) -> list[RawArticle]:
    url = 'https://www.onbid.co.kr/op/ape/article/selectArticleList.do'
    try:
        async with httpx.AsyncClient(timeout=15, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.onbid.co.kr/',
        }) as client:
            res = await client.post(url, data={
                'goodsClsNo': '11', 'orderByCd': '01', 'pageNo': '1', 'pageSize': '10',
            })
        results = []
        for item in res.json().get('articleList', [])[:10]:
            name = item.get('goodsNm', '')
            price = item.get('apprAmt', '')
            addr = item.get('addr', '')
            date_str = item.get('bidDt', '')
            title = f'[공매] {addr} {name} 감정가 {price}원 ({date_str})'
            results.append(RawArticle(
                source='onbid', title=title,
                url=f'https://www.onbid.co.kr/op/ape/article/selectArticleDetail.do?caseCd={item.get("caseCd","")}',
                content=title, published_at=datetime.now(),
            ))
        return results
    except Exception:
        return []
