import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from crawlers.base import RawArticle
from processors.classifier import classify_articles, BATCH_SIZE


def make_article(i: int, title: str = '') -> RawArticle:
    return RawArticle(
        source='test', title=title or f'테스트 기사 {i}',
        url=f'https://example.com/{i}', content='부동산 관련 내용입니다.',
        published_at=datetime.now(),
    )


MOCK_RESPONSE = [
    {
        'index': 0,
        'category': '금리',
        'regions': ['서울'],
        'importance': 8,
        'urgent': True,
        'summary': '금리 인상으로 인한 대출 부담 증가',
    },
    {
        'index': 1,
        'category': '시세',
        'regions': ['서울 마포구'],
        'importance': 5,
        'urgent': False,
        'summary': '마포구 아파트 가격 동향',
    },
]


@pytest.fixture
def mock_anthropic():
    with patch('processors.classifier.AsyncAnthropic') as mock_cls:
        mock_client = MagicMock()
        mock_cls.return_value = mock_client

        mock_message = MagicMock()
        mock_message.content = [MagicMock(text=json.dumps(MOCK_RESPONSE))]

        mock_client.messages.create = AsyncMock(return_value=mock_message)
        yield mock_client


class TestClassifyArticles:
    def test_returns_classified_articles(self, mock_anthropic):
        articles = [make_article(0), make_article(1)]
        result = asyncio.run(classify_articles(articles, 'fake-key'))
        assert len(result) == 2

    def test_sets_category(self, mock_anthropic):
        articles = [make_article(0), make_article(1)]
        result = asyncio.run(classify_articles(articles, 'fake-key'))
        assert result[0].category == '금리'
        assert result[1].category == '시세'

    def test_sets_urgent_flag(self, mock_anthropic):
        articles = [make_article(0), make_article(1)]
        result = asyncio.run(classify_articles(articles, 'fake-key'))
        assert result[0].urgent is True
        assert result[1].urgent is False

    def test_sets_importance(self, mock_anthropic):
        articles = [make_article(0), make_article(1)]
        result = asyncio.run(classify_articles(articles, 'fake-key'))
        assert result[0].importance == 8
        assert result[1].importance == 5

    def test_preserves_original_fields(self, mock_anthropic):
        article = make_article(0, title='금리 인상 뉴스')
        result = asyncio.run(classify_articles([article, make_article(1)], 'fake-key'))
        assert result[0].title == '금리 인상 뉴스'
        assert result[0].source == 'test'

    def test_batches_large_input(self, mock_anthropic):
        articles = [make_article(i) for i in range(BATCH_SIZE + 1)]
        mock_anthropic.messages.create.return_value = MagicMock(
            content=[MagicMock(text=json.dumps([{
                'index': j, 'category': '기타', 'regions': [],
                'importance': 5, 'urgent': False, 'summary': '',
            } for j in range(min(BATCH_SIZE, len(articles)))]))]
        )
        asyncio.run(classify_articles(articles, 'fake-key'))
        assert mock_anthropic.messages.create.call_count >= 2

    def test_handles_api_error_gracefully(self):
        with patch('processors.classifier.AsyncAnthropic') as mock_cls:
            mock_client = MagicMock()
            mock_cls.return_value = mock_client
            mock_client.messages.create = AsyncMock(side_effect=Exception('API Error'))
            articles = [make_article(0)]
            result = asyncio.run(classify_articles(articles, 'fake-key'))
            assert result == []

    def test_empty_input(self, mock_anthropic):
        result = asyncio.run(classify_articles([], 'fake-key'))
        assert result == []
        mock_anthropic.messages.create.assert_not_called()
