import json
import re
import logging
import anthropic as sdk

logger = logging.getLogger(__name__)


def _extract_json(text: str):
    text = text.strip()
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Strip markdown code block
    m = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if m:
        return json.loads(m.group(1))
    # Find first {...} object
    m = re.search(r'\{[\s\S]*\}', text)
    if m:
        return json.loads(m.group(0))
    raise json.JSONDecodeError('No JSON found', text, 0)


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

    try:
        msg = await client.messages.create(
            model='claude-haiku-4-5-20251001', max_tokens=512,
            messages=[{'role': 'user', 'content': prompt}],
        )
        raw = msg.content[0].text if msg.content else ''
        logger.info(f'브리핑 응답: {raw[:200]}')
        result = _extract_json(raw)
        return {
            'content': result.get('content', ''),
            'signal': result.get('signal', 'wait'),
            'signal_reason': result.get('signal_reason', ''),
        }
    except Exception as e:
        logger.error(f'브리핑 생성 실패: {e}')
        return {'content': '오늘의 브리핑을 생성하지 못했습니다.', 'signal': 'wait', 'signal_reason': ''}
