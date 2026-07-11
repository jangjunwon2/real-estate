import json
import re
import logging
import anthropic as sdk

logger = logging.getLogger(__name__)

REGULATION_CONTEXT = """
현재 서비스에 반영된 주요 부동산 규정 요약:
- DSR: 은행권 40%, 스트레스DSR 3단계(수도권·규제지역 +3.0%p, 비규제 +0.75%p)
- LTV: 투기과열지구 일반 40%/생애최초 80%(9억이하), 비규제 일반 70%/생애최초 80%
- 디딤돌 신혼특례: 소득 8500만원, 한도 3.2억, 금리 1.85~3.0%
- 신생아 특례: 소득 2억, 한도 5억, 금리 1.6~3.3%
- 보금자리론: 일반 소득 7000만원/신혼 8500만원, 한도 3.6억
- 취득세: 1주택 1~3%, 2주택 8%, 3주택+ 12%, 생애최초 감면 최대 200만원
- 종합부동산세: 1세대1주택 공제 12억, 인별 9억, 공정시장가액비율 60%, 세부담상한 150%
- 청약: 서울 전역 토허제·투기과열·조정대상지역, 재당첨제한 10년
"""


def _extract_json(text: str):
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if m:
        return json.loads(m.group(1))
    m = re.search(r'\{[\s\S]*\}', text)
    if m:
        return json.loads(m.group(0))
    raise json.JSONDecodeError('No JSON found', text, 0)


async def detect_policy_changes(articles: list[dict], anthropic_api_key: str) -> list[dict]:
    """'정책' 카테고리 + importance>=7 기사 중, 기존 규정을 변경시키는 기사를 감지해
    {article_url, article_title, regulation_path, ai_summary, proposed_diff} 목록을 반환한다.
    변경이 없다고 판단되거나 파싱에 실패하면 해당 기사는 건너뛴다."""
    candidates = [
        a for a in articles
        if a.get('category') == '정책' and (a.get('importance') or 0) >= 7
    ]
    if not candidates:
        return []

    client = sdk.AsyncAnthropic(api_key=anthropic_api_key)
    proposals: list[dict] = []

    for article in candidates:
        prompt = f"""{REGULATION_CONTEXT}

아래 기사가 위 규정 중 하나를 실제로 변경하는 내용인지 판단하세요.

기사 제목: {article.get('title', '')}
기사 요약: {article.get('summary', '')}

변경사항이 없거나 확실하지 않으면 {{"changed": false}}만 응답하세요.
변경사항이 있으면 아래 JSON 형식으로만 응답하세요:
{{"changed": true, "regulation_path": "예: PROPERTY_TAX.rates.general", "ai_summary": "무엇이 어떻게 바뀌는지 2줄 요약", "proposed_diff": "regulations.ts에 적용할 TypeScript 코드 스니펫", "confidence": "high|medium|low"}}"""
        try:
            msg = await client.messages.create(
                model='claude-sonnet-5', max_tokens=1024,
                messages=[{'role': 'user', 'content': prompt}],
            )
            raw = msg.content[0].text if msg.content else ''
            result = _extract_json(raw)
            if result.get('changed'):
                proposals.append({
                    'article_url': article.get('url'),
                    'article_title': article.get('title', ''),
                    'regulation_path': result.get('regulation_path', ''),
                    'ai_summary': result.get('ai_summary', ''),
                    'proposed_diff': result.get('proposed_diff', ''),
                })
        except Exception as e:
            logger.warning(f'정책 변경 감지 실패 (기사: {article.get("title", "")[:30]}): {type(e).__name__}: {e}')

    logger.info(f'정책 변경 제안 {len(proposals)}건 감지')
    return proposals
