import asyncio
import httpx


async def fetch_location_score(lat: float, lng: float, kakao_rest_api_key: str) -> dict:
    headers = {'Authorization': f'KakaoAK {kakao_rest_api_key}'}
    base = 'https://dapi.kakao.com/v2/local/search/keyword.json'
    cats = [('SW8', 'subway'), ('SC4', 'school'), ('MT1', 'mart'), ('HP8', 'hospital'), ('PK6', 'park')]

    async def search(code: str, label: str):
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(base, headers=headers, params={
                'category_group_code': code,
                'x': str(lng), 'y': str(lat),
                'radius': 2000, 'size': 5,
            })
            res.raise_for_status()
            return label, res.json().get('documents', [])

    results = await asyncio.gather(*[search(c, l) for c, l in cats], return_exceptions=True)
    data: dict = {l: [] for _, l in cats}
    for r in results:
        if not isinstance(r, Exception):
            label, docs = r
            data[label] = docs

    def d2m(d: str | None) -> int | None:
        try:
            return max(1, round(int(d) / 70))
        except Exception:
            return None

    subway = data.get('subway', [])
    schools = [s for s in data.get('school', []) if int(s.get('distance', 9999)) <= 1000]
    mart = data.get('mart', [])
    hosp = data.get('hospital', [])
    park = data.get('park', [])
    mart_m = d2m(mart[0].get('distance')) if mart else None
    hosp_m = d2m(hosp[0].get('distance')) if hosp else None
    park_m = d2m(park[0].get('distance')) if park else None
    items = [x for x in [mart_m, hosp_m, park_m] if x is not None]

    return {
        'nearest_subway': subway[0]['place_name'] if subway else '',
        'nearest_subway_min': d2m(subway[0].get('distance')) if subway else None,
        'school_score': min(100, len(schools) * 25),
        'school_count_1km': len(schools),
        'convenience_score': max(0, 100 - int(sum(items) / len(items))) if items else 50,
        'mart_min': mart_m,
        'hospital_min': hosp_m,
        'park_min': park_m,
    }
