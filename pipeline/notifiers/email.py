import resend
from datetime import date

SIGNAL_LABEL = {
    'buy': '🔴 매수 적기',
    'wait': '🟡 관망',
    'avoid': '🔵 매수 자제',
}


async def send_briefing_email(config, content: str, signal: str | None = None) -> None:
    resend.api_key = config.resend_api_key
    today = date.today().strftime('%Y년 %m월 %d일')
    signal_html = (
        f'<p style="font-size:18px;font-weight:bold">{SIGNAL_LABEL.get(signal, "")}</p>'
        if signal else ''
    )
    html = f"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:22px;margin:0 0 8px">🏠 {today} 부동산 브리핑</h1>
  {signal_html}
  <div style="background:#f8fafc;border-radius:8px;padding:16px;line-height:1.7;white-space:pre-wrap">{content}</div>
  <p style="color:#888;font-size:12px;margin-top:24px">부동산AI — 신혼부부 맞춤 서비스</p>
</body></html>"""
    resend.Emails.send({
        'from': '부동산AI <brief@yourdomain.com>',
        'to': config.user_email,
        'subject': f'[부동산AI] {today} 부동산 브리핑',
        'html': html,
    })
