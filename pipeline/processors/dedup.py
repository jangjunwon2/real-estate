from crawlers.base import RawArticle

KEYWORDS = [
    '아파트', '주택', '부동산', '청약', '전세', '매매', '경매', '재건축',
    '재개발', '금리', '대출', '취득세', '양도세', '분양', '임대', 'LTV', 'DSR',
]


def deduplicate(articles: list[RawArticle]) -> list[RawArticle]:
    seen: set[str] = set()
    result = []
    for a in articles:
        if a.url not in seen:
            seen.add(a.url)
            result.append(a)
    return result


def filter_real_estate(articles: list[RawArticle]) -> list[RawArticle]:
    # Title must contain at least one keyword — content-only matches are too noisy
    return [
        a for a in articles
        if any(kw.lower() in a.title.lower() for kw in KEYWORDS)
    ]
