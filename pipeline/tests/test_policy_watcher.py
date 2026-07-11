import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from processors.policy_watcher import detect_policy_changes, _extract_json


def test_extract_json_handles_plain_json():
    assert _extract_json('{"changed": false}') == {'changed': False}


def test_extract_json_handles_markdown_fence():
    text = '```json\n{"changed": true, "regulation_path": "X"}\n```'
    assert _extract_json(text) == {'changed': True, 'regulation_path': 'X'}


@pytest.mark.asyncio
async def test_detect_policy_changes_skips_non_policy_articles():
    articles = [{'title': 'A', 'category': '시세', 'importance': 9, 'summary': 'x'}]
    result = await detect_policy_changes(articles, 'fake-key')
    assert result == []


@pytest.mark.asyncio
async def test_detect_policy_changes_skips_low_importance():
    articles = [{'title': 'A', 'category': '정책', 'importance': 3, 'summary': 'x'}]
    result = await detect_policy_changes(articles, 'fake-key')
    assert result == []


@pytest.mark.asyncio
async def test_detect_policy_changes_returns_proposal_when_ai_detects_change():
    articles = [{
        'title': '종부세 공정시장가액비율 80%로 인상',
        'category': '정책', 'importance': 9, 'summary': '요약',
        'url': 'https://example.com/a',
    }]
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='{"changed": true, "regulation_path": "PROPERTY_TAX.fairMarketValueRatio", "ai_summary": "80%로 인상", "proposed_diff": "fairMarketValueRatio: 0.80,", "confidence": "high"}')]

    with patch('processors.policy_watcher.sdk.AsyncAnthropic') as MockClient:
        instance = MockClient.return_value
        instance.messages.create = AsyncMock(return_value=mock_response)
        result = await detect_policy_changes(articles, 'fake-key')

    assert len(result) == 1
    assert result[0]['regulation_path'] == 'PROPERTY_TAX.fairMarketValueRatio'
    assert result[0]['article_url'] == 'https://example.com/a'
    assert result[0]['article_title'] == '종부세 공정시장가액비율 80%로 인상'


@pytest.mark.asyncio
async def test_detect_policy_changes_skips_when_ai_says_unchanged():
    articles = [{'title': 'A', 'category': '정책', 'importance': 9, 'summary': 'x', 'url': 'u'}]
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='{"changed": false}')]

    with patch('processors.policy_watcher.sdk.AsyncAnthropic') as MockClient:
        instance = MockClient.return_value
        instance.messages.create = AsyncMock(return_value=mock_response)
        result = await detect_policy_changes(articles, 'fake-key')

    assert result == []
