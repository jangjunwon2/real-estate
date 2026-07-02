import json
import asyncio
import anthropic


async def score_properties(
    raw_list: list[dict],
    anthropic_api_key: str,
    user_region: str = '',
    user_budget_max: int = 60000,
) -> list[dict]:
    client = anthropic.AsyncAnthropic(api_key=anthropic_api_key)
    sem = asyncio.Semaphore(3)

    async def score_one(prop: dict) -> dict | None:
        async with sem:
            try:
                msg = await client.messages.create(
                    model='claude-haiku-4-5-20251001', max_tokens=600,
                    messages=[{'role': 'user', 'content':
                        f'부동산 매물 분석 후 JSON만 응답 (다른 텍스트 금지):\n'
                        f'매물: {json.dumps(prop, ensure_ascii=False)}\n'
                        f'사용자: 관심지역={user_region}, 예산최대={user_budget_max}만원\n'
                        f'응답형식: {{"price_score":정수0-20,"location_score":정수0-25,'
                        f'"complex_score":정수0-20,"demand_score":정수0-20,'
                        f'"regulatory_score":정수0-15,'
                        f'"price":만원단위정수_추출불가시null,'
                        f'"area_sqm":소수숫자_추출불가시null,'
                        f'"auction_date":"YYYY-MM-DD"_없으면null,'
                        f'"pros":["장점1","장점2"],"cons":["단점1"],'
                        f'"ai_summary":"2줄요약","personalized_reason":"맞춤이유1줄"}}'}],
                )
                raw_text = msg.content[0].text.strip()
                # JSON 블록만 추출 (```json ... ``` 포함 대응)
                if '```' in raw_text:
                    raw_text = raw_text.split('```')[-2].lstrip('json').strip()
                result = json.loads(raw_text)
                total = sum(result.get(k, 0) for k in [
                    'price_score', 'location_score', 'complex_score',
                    'demand_score', 'regulatory_score',
                ])
                return {**prop, **result, 'total_score': total}
            except Exception:
                return None

    scored = await asyncio.gather(*[score_one(p) for p in raw_list])
    return [s for s in scored if s is not None]
