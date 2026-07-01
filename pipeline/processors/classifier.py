import json
import re
import asyncio
import logging
from anthropic import AsyncAnthropic
from crawlers.base import RawArticle, ClassifiedArticle

logger = logging.getLogger(__name__)

BATCH_SIZE = 10
PROMPT = """다음 기사 목록에서 주택·부동산 구매/임대/투자에 직접 관련된 기사만 분류하고 JSON 배열로만 응답.

기사 목록:
{articles_json}

각 기사에 대해:
[{{"index":0,"category":"정책|금리|시세|청약|세금|경매|재개발|기타","regions":["서울 마포구"],"importance":1-10,"urgent":false,"summary":"2줄 요약"}}]

importance 기준:
- 8-10: 청약/매매/경매/정책 직접 관련, 신혼부부·생애최초 영향 큰 뉴스
- 5-7: 금리·시세·세금 등 부동산에 간접 영향
- 1-4: 부동산과 무관하거나 매우 일반적인 경제 기사 (주식·소비·무역 등)

urgent=true 조건: 정책 당일시행 D-3이내, 금리 0.5%p이상 변동, 긴급청약/줍줍"""


def _extract_json_array(text: str) -> list:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if m:
        return json.loads(m.group(1))
    m = re.search(r'\[[\s\S]*\]', text)
    if m:
        return json.loads(m.group(0))
    raise json.JSONDecodeError('No JSON array found', text, 0)


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
                raw = msg.content[0].text if msg.content else ''
                if not raw:
                    logger.error('배치 분류 실패: 빈 응답')
                    return []
                logger.info(f'분류 응답 미리보기: {raw[:100]}')
                items = _extract_json_array(raw)
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
            except Exception as e:
                logger.error(f'배치 분류 실패: {type(e).__name__}: {e}')
                return []

    for b in await asyncio.gather(*[classify_batch(b) for b in batches]):
        results.extend(b)
    logger.info(f'분류 완료: {len(results)}건')
    return results
