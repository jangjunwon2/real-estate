import resend


async def send_urgent_alert(config, articles: list[dict]) -> None:
    if not articles:
        return
    lines = '\n'.join(f'• {a.get("title", "")}' for a in articles[:3])
    if not config.kakao_template_urgent or not config.solapi_api_key:
        await _send_fallback_email(
            config, '⚠️ 긴급 부동산 뉴스',
            [{'title': a.get('title', ''), 'url': a.get('url')} for a in articles[:3]],
        )
        return
    try:
        import solapi
        client = solapi.SolapiMessageService(config.solapi_api_key, config.solapi_api_secret)
        client.send_one({
            'type': 'ATA', 'to': config.user_phone, 'from': config.kakao_sender_key,
            'kakaoOptions': {
                'pfId': config.kakao_sender_key,
                'templateId': config.kakao_template_urgent,
                'variables': {'#{긴급뉴스}': lines},
            },
        })
    except Exception:
        await _send_fallback_email(
            config, '⚠️ 긴급 부동산 뉴스',
            [{'title': a.get('title', ''), 'url': a.get('url')} for a in articles[:3]],
        )


async def send_property_alert(config, properties: list[dict]) -> None:
    if not properties:
        return
    lines = '\n'.join(
        f'• {p.get("title", "매물")} | {p.get("price", "?")}만원 | AI {p.get("total_score", "?")}점'
        for p in properties[:3]
    )
    if not config.kakao_template_property or not config.solapi_api_key:
        await _send_fallback_email(
            config, '[부동산AI] 오늘의 추천 매물',
            [{
                'title': f'{p.get("title", "매물")} · {p.get("price", "?")}만원 · AI {p.get("total_score", "?")}점',
                'url': p.get('source_url'),
            } for p in properties[:3]],
        )
        return
    try:
        import solapi
        client = solapi.SolapiMessageService(config.solapi_api_key, config.solapi_api_secret)
        client.send_one({
            'type': 'ATA', 'to': config.user_phone, 'from': config.kakao_sender_key,
            'kakaoOptions': {
                'pfId': config.kakao_sender_key,
                'templateId': config.kakao_template_property,
                'variables': {'#{매물목록}': lines},
            },
        })
    except Exception:
        await _send_fallback_email(
            config, '[부동산AI] 오늘의 추천 매물',
            [{
                'title': f'{p.get("title", "매물")} · {p.get("price", "?")}만원 · AI {p.get("total_score", "?")}점',
                'url': p.get('source_url'),
            } for p in properties[:3]],
        )


async def _send_fallback_email(config, subject: str, items: list[dict]) -> None:
    """카카오 알림톡 미설정 시 사용하는 이메일 폴백.
    각 항목의 전체 제목과 링크를 그대로 보여줘 잘려나가거나 링크가 빠지지 않게 한다."""
    resend.api_key = config.resend_api_key
    rows = ''.join(
        f'<li style="padding:8px 0;border-bottom:1px solid #f0f0f0">'
        f'<a href="{item["url"]}" style="color:#1a1a1a;text-decoration:none;font-size:14px">{item["title"]}</a>'
        f'</li>'
        if item.get('url') else
        f'<li style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px">{item["title"]}</li>'
        for item in items
    )
    html = f"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:18px;margin:0 0 12px">{subject}</h1>
  <ul style="list-style:none;margin:0;padding:0">{rows}</ul>
  <p style="color:#888;font-size:12px;margin-top:24px">부동산AI — 신혼부부 맞춤 서비스</p>
</body></html>"""
    resend.Emails.send({
        'from': f'부동산AI <{config.resend_from}>',
        'to': config.user_email,
        'subject': subject,
        'html': html,
    })
