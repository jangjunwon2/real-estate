import resend


async def send_urgent_alert(config, articles: list[dict]) -> None:
    if not articles:
        return
    lines = '\n'.join(f'• {a.get("title", "")[:40]}' for a in articles[:3])
    if not config.kakao_template_urgent or not config.solapi_api_key:
        await _send_fallback_email(config, f'긴급 부동산 뉴스\n\n{lines}', '⚠️ 긴급 부동산 뉴스')
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
        await _send_fallback_email(config, f'긴급 부동산 뉴스\n\n{lines}', '⚠️ 긴급 부동산 뉴스')


async def send_property_alert(config, properties: list[dict]) -> None:
    if not properties:
        return
    body = '\n'.join(
        f'• {p.get("complex_name", "매물")} | {p.get("price", "?")}만원 | AI {p.get("total_score", "?")}점'
        for p in properties[:3]
    )
    if not config.kakao_template_property or not config.solapi_api_key:
        await _send_fallback_email(config, body, '[부동산AI] 오늘의 추천 매물')
        return
    try:
        import solapi
        client = solapi.SolapiMessageService(config.solapi_api_key, config.solapi_api_secret)
        client.send_one({
            'type': 'ATA', 'to': config.user_phone, 'from': config.kakao_sender_key,
            'kakaoOptions': {
                'pfId': config.kakao_sender_key,
                'templateId': config.kakao_template_property,
                'variables': {'#{매물목록}': body},
            },
        })
    except Exception:
        await _send_fallback_email(config, body, '[부동산AI] 오늘의 추천 매물')


async def _send_fallback_email(config, body: str, subject: str) -> None:
    resend.api_key = config.resend_api_key
    resend.Emails.send({
        'from': '부동산AI <brief@yourdomain.com>',
        'to': config.user_email,
        'subject': subject,
        'html': f'<pre style="font-family:sans-serif;line-height:1.7">{body}</pre>',
    })
