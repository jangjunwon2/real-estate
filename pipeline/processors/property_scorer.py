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
                    model='claude-haiku-4-5-20251001', max_tokens=512,
                    messages=[{'role': 'user', 'content':
                        f'부동산 매물 분석 후 JSON만 응답:\n'
                        f'매물: {json.dumps(prop, ensure_ascii=False)}\n'
                        f'사용자: 관심지역={user_region}, 예산최대={user_budget_max}만원\n'
                        f'{{"price_score":0-20,"location_score":0-25,"complex_score":0-20,'
                        f'"demand_score":0-20,"regulatory_score":0-15,"pros":["장점"],'
                        f'"cons":["단점"],"ai_summary":"2줄 요약","personalized_reason":"맞춤 이유 1줄"}}'}],
                )
                result = json.loads(msg.content[0].text)
                total = sum(result.get(k, 0) for k in [
                    'price_score', 'location_score', 'complex_score',
                    'demand_score', 'regulatory_score',
                ])
                return {**prop, **result, 'total_score': total}
            except Exception:
                return None

    scored = await asyncio.gather(*[score_one(p) for p in raw_list])
    return [s for s in scored if s is not None]
