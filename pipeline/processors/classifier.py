import json
import asyncio
from anthropic import AsyncAnthropic
from crawlers.base import RawArticle, ClassifiedArticle

BATCH_SIZE = 10
PROMPT = """다음 부동산 기사 목록을 분석하고 JSON 배열로만 응답 (설명 없이).

기사 목록:
{articles_json}

각 기사에 대해:
[{{"index":0,"category":"정책|금리|시세|청약|세금|경매|재개발|기타","regions":["서울 마포구"],"importance":1-10,"urgent":true,"summary":"3줄 요약"}}]

urgent=true 조건: 정책 당일시행 D-3이내, 금리 0.5%p이상 변동, 긴급청약/줍줍"""


async def classify_articles(articles: list[RawArticle], anthropic_api_key: str) -> list[ClassifiedArticle]:
    client = AsyncAnthropic(api_key=anthropic_api_key)
    batches = [articles[i:i + BATCH_SIZE] for i in range(0, len(articles), BATCH_SIZE)]
    sem = asyncio.Semaphore(3)
    results: list[ClassifiedArticle] = []

    async def classify_batch(batch: list[RawArticle]) -> list[ClassifiedArticle]:
        async with sem:
            articles_json = json.dumps(
                [{'index': i, 'title': a.title, 'content': a.content[:500]}
                 for i, a in enumerate(batch)],
                ensure_ascii=False,
            )
            try:
                msg = await client.messages.create(
                    model='claude-haiku-4-5-20251001', max_tokens=2048,
                    messages=[{'role': 'user', 'content': PROMPT.format(articles_json=articles_json)}],
                )
                items = json.loads(msg.content[0].text)
                return [ClassifiedArticle(
                    source=batch[it['index']].source,
                    title=batch[it['index']].title,
                    url=batch[it['index']].url,
                    content=batch[it['index']].content,
                    published_at=batch[it['index']].published_at,
                    category=it.get('category', '기타'),
                    regions=it.get('regions', []),
                    importance=it.get('importance', 5),
                    urgent=it.get('urgent', False),
                    summary=it.get('summary', ''),
                ) for it in items if it.get('index', -1) < len(batch)]
            except Exception:
                return []

    for b in await asyncio.gather(*[classify_batch(b) for b in batches]):
        results.extend(b)
    return results
