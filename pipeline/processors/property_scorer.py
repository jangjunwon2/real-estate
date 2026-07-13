import json
import asyncio
import anthropic

# 2026.7 기준 대출·규제 요약 — regulatory_score·personalized_reason이 실제 규제를 반영하도록
# 프롬프트에 주입. 규정 변경 시 web/lib/regulations.ts와 함께 갱신할 것.
REGULATION_CONTEXT = (
    '[2026.7 기준 부동산 대출·규제 — 점수와 맞춤 이유에 반드시 반영]\n'
    '- 규제지역(투기과열+조정): 서울 25개구 전역, 경기 과천·광명·의왕·하남시, '
    '성남(분당·수정·중원), 수원(영통·장안·팔달), 안양 동안구, 용인 수지구\n'
    '- 서울 전역 토지거래허가구역(~2026.12.31): 구청 허가 필수, 실거주 2년 의무, '
    '전세 낀 매수(갭투자) 불가\n'
    '- 규제지역 LTV 40% (생애최초 70%) + 주담대 절대한도: 시가 15억이하 6억 / 15~25억 4억 / 25억초과 2억\n'
    '- 수도권(서울·경기·인천) 전체: 스트레스DSR +3.0%p 가산으로 대출한도 대폭 감소, '
    '유주택자 추가구입 주담대 금지, 절대한도 동일 적용\n'
    '- 비수도권: 스트레스DSR +0.75%p, LTV 70% (생애최초 80%, 한도 6억)\n'
    '- DSR 40%(은행권): 총대출 1억 초과 시 연간 원리금이 연소득의 40% 초과 불가\n'
    '- 규제지역 다주택 취득세 중과(2주택 8%, 3주택+ 12%), 양도세 중과 유의\n'
)


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
                        f'{REGULATION_CONTEXT}'
                        f'매물: {json.dumps(prop, ensure_ascii=False)}\n'
                        f'사용자: 관심지역={user_region}, 예산최대={user_budget_max}만원\n'
                        f'regulatory_score는 위 규제가 이 매물 지역·가격에 미치는 영향'
                        f'(대출한도 축소, 토허제 실거주 의무, 취득세 중과 등)을 근거로 산정하고, '
                        f'personalized_reason·cons에도 해당되는 규제 영향을 구체적으로 언급할 것.\n'
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
