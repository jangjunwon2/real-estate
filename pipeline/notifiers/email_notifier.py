import resend
from datetime import date

SIGNAL_LABEL = {
    'buy': '🔴 매수 적기',
    'wait': '🟡 관망',
    'avoid': '🔵 매수 자제',
}

CATEGORY_EMOJI = {
    '정책': '📋', '금리': '📈', '시세': '🏠', '청약': '📝',
    '세금': '💰', '경매': '⚖️', '재개발': '🏗️', '기타': '📰',
}


def _article_rows(articles: list[dict], max_count: int = 10) -> str:
    top = sorted(articles, key=lambda x: x.get('importance') or 0, reverse=True)[:max_count]
    rows = []
    for a in top:
        emoji = CATEGORY_EMOJI.get(a.get('category', ''), '📰')
        urgent = '<span style="color:#ef4444;font-weight:bold">[긴급] </span>' if a.get('urgent') else ''
        category = a.get('category') or '기타'
        importance = a.get('importance') or 5
        title = a.get('title', '')
        url = a.get('url', '#')
        rows.append(
            f'<li style="padding:6px 0;border-bottom:1px solid #f0f0f0">'
            f'{urgent}'
            f'<span style="font-size:11px;background:#f3f4f6;border-radius:3px;padding:1px 5px;margin-right:6px">'
            f'{emoji} {category}</span>'
            f'<a href="{url}" style="color:#1a1a1a;text-decoration:none;font-size:13px">{title}</a>'
            f'<span style="color:#9ca3af;font-size:11px;margin-left:6px">중요도 {importance}/10</span>'
            f'</li>'
        )
    return '<ul style="list-style:none;margin:0;padding:0">' + ''.join(rows) + '</ul>'


async def send_briefing_email(
    config,
    content: str,
    signal: str | None = None,
    articles: list[dict] | None = None,
) -> None:
    resend.api_key = config.resend_api_key
    today = date.today().strftime('%Y년 %m월 %d일')

    signal_html = (
        f'<p style="font-size:18px;font-weight:bold;margin:0 0 12px">{SIGNAL_LABEL.get(signal, "")}</p>'
        if signal else ''
    )

    article_section = ''
    if articles:
        article_section = f"""
<div style="margin-top:24px">
  <h2 style="font-size:15px;font-weight:600;margin:0 0 10px">오늘의 주요 뉴스</h2>
  {_article_rows(articles)}
</div>"""

    html = f"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:22px;margin:0 0 8px">🏠 {today} 부동산 브리핑</h1>
  {signal_html}
  <div style="background:#f8fafc;border-radius:8px;padding:16px;line-height:1.7;white-space:pre-wrap">{content}</div>
  {article_section}
  <p style="color:#888;font-size:12px;margin-top:24px">부동산AI — 신혼부부 맞춤 서비스</p>
</body></html>"""

    resend.Emails.send({
        'from': config.resend_from,
        'to': config.user_email,
        'subject': f'[부동산AI] {today} 부동산 브리핑',
        'html': html,
    })
