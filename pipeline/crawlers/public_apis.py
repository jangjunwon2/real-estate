import httpx
from datetime import datetime, date
from .base import RawArticle

SEOUL_LAWD_CODES = [
    '11110', '11140', '11170', '11200', '11215',
    '11230', '11260', '11290', '11305', '11320',
]


async def fetch_molit_transactions(config) -> list[RawArticle]:
    ym = date.today().strftime('%Y%m')
    url = ('http://openapi.molit.go.kr/OpenAPI_ToolInstallPackage/service/rest'
           '/RTMSOBJSvc/getRTMSDataSvcAptTradeDev')
    results = []
    for lawd_cd in SEOUL_LAWD_CODES:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.get(url, params={
                    'serviceKey': config.molit_api_key,
                    'LAWD_CD': lawd_cd,
                    'DEAL_YMD': ym,
                    'numOfRows': 10,
                    'pageNo': 1,
                })
            items = (res.json().get('response', {}).get('body', {})
                     .get('items', {}).get('item', []))
            if isinstance(items, dict):
                items = [items]
            for item in items[:3]:
                name = item.get('아파트', '')
                price = item.get('거래금액', '').replace(',', '')
                area = item.get('전용면적', '')
                dong = item.get('법정동', '')
                floor = item.get('층', '')
                title = f'[실거래] {dong} {name} {area}m2 {price}만원 ({floor}층)'
                results.append(RawArticle(
                    source='molit', title=title,
                    url=f'https://rt.molit.go.kr/pt/xif/xifNtbDir.do?lawdCd={lawd_cd}&ym={ym}',
                    content=title, published_at=datetime.now(),
                ))
        except Exception:
            pass
    return results


async def fetch_bok_rate(config) -> list[RawArticle]:
    if not config.bok_api_key:
        return []
    ym = date.today().strftime('%Y%m')
    url = (f'https://ecos.bok.or.kr/api/StatisticSearch/{config.bok_api_key}'
           f'/json/kr/1/5/722Y001/D/{ym}01/{ym}31/0000000')
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(url)
        rows = res.json().get('StatisticSearch', {}).get('row', [])
        if not rows:
            return []
        latest = rows[-1]
        rate = latest.get('DATA_VALUE', '')
        title = f'[한은] 기준금리 {rate}% ({latest.get("TIME", "")})'
        return [RawArticle(
            source='bok', title=title,
            url='https://www.bok.or.kr/portal/main/contents.do?menuNo=200656',
            content=title, published_at=datetime.now(),
        )]
    except Exception:
        return []


async def fetch_subscriptions(config) -> list[RawArticle]:
    url = 'https://www.apt2you.com/api/notice/noticeList'
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(url, params={'pageIndex': 1, 'pageSize': 5, 'noticeGbn': '01'})
        results = []
        for item in res.json().get('list', []):
            title = (f'[청약] {item.get("houseNm", "")} {item.get("hssplyAdres", "")}'
                     f' ({item.get("rcritPblancDe", "")}~{item.get("subscrptRceptEndde", "")})')
            results.append(RawArticle(
                source='subscription', title=title,
                url=f'https://www.apt2you.com/notice/{item.get("pblancNo", "")}',
                content=title, published_at=datetime.now(),
            ))
        return results
    except Exception:
        return []
