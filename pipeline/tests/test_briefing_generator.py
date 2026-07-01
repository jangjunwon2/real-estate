import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from processors.briefing_generator import generate_briefing


def make_classified(i: int, importance: int = 5, urgent: bool = False) -> dict:
    return {
        'title': f'기사 {i}', 'category': '정책',
        'importance': importance, 'urgent': urgent,
        'summary': f'요약 {i}', 'url': f'https://example.com/{i}',
    }


@pytest.fixture
def mock_anthropic():
    with patch('processors.briefing_generator.sdk.AsyncAnthropic') as mock_cls:
        mock_client = MagicMock()
        mock_cls.return_value = mock_client
        mock_client.messages.create = AsyncMock(return_value=MagicMock(
            content=[MagicMock(text=json.dumps({
                'content': '오늘 부동산 시장은 금리 인상 영향으로 관망세가 지속되고 있습니다.',
                'signal': 'wait',
                'signal_reason': '금리 인상 우려가 지속되고 있어 당분간 관망이 적합합니다.',
            }))]
        ))
        yield mock_client


class TestGenerateBriefing:
    def test_returns_content(self, mock_anthropic):
        articles = [make_classified(i) for i in range(3)]
        result = asyncio.run(generate_briefing(articles, 'fake-key'))
        assert 'content' in result
        assert len(result['content']) > 0

    def test_returns_valid_signal(self, mock_anthropic):
        articles = [make_classified(i) for i in range(3)]
        result = asyncio.run(generate_briefing(articles, 'fake-key'))
        assert result['signal'] in ('buy', 'wait', 'avoid')

    def test_returns_signal_reason(self, mock_anthropic):
        articles = [make_classified(i) for i in range(3)]
        result = asyncio.run(generate_briefing(articles, 'fake-key'))
        assert 'signal_reason' in result

    def test_empty_articles_uses_defaults(self, mock_anthropic):
        result = asyncio.run(generate_briefing([], 'fake-key'))
        assert result['signal'] in ('buy', 'wait', 'avoid')

    def test_sorts_by_importance(self, mock_anthropic):
        articles = [make_classified(i, importance=i) for i in range(20)]
        asyncio.run(generate_briefing(articles, 'fake-key'))
        call_args = mock_anthropic.messages.create.call_args
        prompt = call_args.kwargs['messages'][0]['content']
        assert '[19/10]' in prompt or '19/10' in prompt

    def test_buy_signal_parsing(self):
        with patch('processors.briefing_generator.sdk.AsyncAnthropic') as mock_cls:
            mock_client = MagicMock()
            mock_cls.return_value = mock_client
            mock_client.messages.create = AsyncMock(return_value=MagicMock(
                content=[MagicMock(text=json.dumps({
                    'content': '매수 적기입니다.', 'signal': 'buy', 'signal_reason': '금리 인하',
                }))]
            ))
            result = asyncio.run(generate_briefing([make_classified(0)], 'fake-key'))
            assert result['signal'] == 'buy'
