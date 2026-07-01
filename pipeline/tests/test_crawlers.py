import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime


@pytest.fixture
def config():
    cfg = MagicMock()
    cfg.naver_client_id = 'test_id'
    cfg.naver_client_secret = 'test_secret'
    return cfg


@pytest.mark.asyncio
async def test_fetch_naver_news_returns_articles(config):
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        'items': [
            {
                'title': '<b>아파트</b> 매매 증가',
                'originallink': 'https://example.com/1',
                'link': 'https://naver.com/1',
                'description': '서울 &quot;아파트&quot; 매매 거래량이 증가했습니다.',
                'pubDate': 'Mon, 01 Jan 2025 09:00:00 +0900',
            }
        ]
    }

    with patch('httpx.AsyncClient') as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        from crawlers.naver_news import fetch_naver_news
        results = await fetch_naver_news(config)

    assert len(results) > 0
    article = results[0]
    assert '<b>' not in article.title
    assert '&quot;' not in article.title
    assert article.source == 'naver'
    assert article.url == 'https://example.com/1'


@pytest.mark.asyncio
async def test_fetch_naver_news_handles_http_error(config):
    import httpx

    with patch('httpx.AsyncClient') as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(side_effect=httpx.RequestError('connection failed'))
        mock_client_cls.return_value = mock_client

        from crawlers.naver_news import fetch_naver_news
        results = await fetch_naver_news(config)

    assert results == []


@pytest.mark.asyncio
async def test_fetch_rss_returns_articles(config):
    rss_xml = b"""<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title>아파트 분양 소식</title>
        <link>https://mk.co.kr/article/1</link>
        <description>서울 아파트 신규 분양 모집</description>
        <pubDate>Mon, 01 Jan 2025 09:00:00 +0900</pubDate>
      </item>
    </channel></rss>"""

    mock_response = MagicMock()
    mock_response.text = rss_xml.decode()

    with patch('httpx.AsyncClient') as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        from crawlers.rss import fetch_rss
        results = await fetch_rss(config)

    assert len(results) > 0
    assert results[0].title == '아파트 분양 소식'
    assert results[0].url == 'https://mk.co.kr/article/1'


@pytest.mark.asyncio
async def test_fetch_rss_handles_malformed_xml(config):
    mock_response = MagicMock()
    mock_response.text = 'NOT VALID XML'

    with patch('httpx.AsyncClient') as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        from crawlers.rss import fetch_rss
        results = await fetch_rss(config)

    assert results == []
