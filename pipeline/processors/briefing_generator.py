import json
import anthropic as sdk


async def generate_briefing(articles: list, anthropic_api_key: str) -> dict:
    client = sdk.AsyncAnthropic(api_key=anthropic_api_key)
    urgent = [a for a in articles if a.get('urgent')]
    top = sorted(articles, key=lambda x: x.get('importance', 0), reverse=True)[:15]

    lines = '\n'.join(f'- [{a.get("importance", 5)}/10] {a["title"]}' for a in top)
    prompt = f"""당신은 신혼부부 생애최초 주택구매를 돕는 AI 어드바이저입니다.
오늘의 부동산 뉴스를 분석해 아래 JSON 형식으로만 응답하세요:

뉴스 {len(top)}건 (긴급 {len(urgent)}건):
{lines}

{{"content":"200자 내외 브리핑. 핵심 3가지 + 생애최초 구매자 영향.","signal":"buy|wait|avoid","signal_reason":"신호 판단 근거 1~2줄"}}

signal 기준: buy=금리인하+규제완화+시장안정 동시, avoid=금리인상+규제강화+시장불안 동시, wait=그 외"""

    msg = await client.messages.create(
        model='claude-haiku-4-5', max_tokens=512,
        messages=[{'role': 'user', 'content': prompt}],
    )
    result = json.loads(msg.content[0].text)
    return {
        'content': result.get('content', ''),
        'signal': result.get('signal', 'wait'),
        'signal_reason': result.get('signal_reason', ''),
    }
