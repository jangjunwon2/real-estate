import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import json


MOCK_SCORE = {
    'price_score': 15,
    'location_score': 20,
    'complex_score': 16,
    'demand_score': 18,
    'regulatory_score': 12,
    'pros': ['역세권', '학군 우수'],
    'cons': ['주차 부족'],
    'ai_summary': '서울 마포구 역세권 아파트. 가격 대비 입지 우수.',
    'personalized_reason': '생애최초 예산 내 진입 가능한 매물입니다.',
}


def make_mock_anthropic(response_text: str):
    mock_msg = MagicMock()
    mock_msg.content = [MagicMock(text=response_text)]
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_msg)
    return mock_client


@pytest.mark.asyncio
async def test_score_properties_returns_scored_list():
    props = [
        {'title': '마포 아파트', 'price': 50000, 'property_type': 'sale'},
        {'title': '서초 아파트', 'price': 80000, 'property_type': 'sale'},
    ]

    with patch('anthropic.AsyncAnthropic', return_value=make_mock_anthropic(json.dumps(MOCK_SCORE))):
        from processors.property_scorer import score_properties
        result = await score_properties(props, 'test-key', '서울', 60000)

    assert len(result) == 2
    assert result[0]['total_score'] == 81  # 15+20+16+18+12
    assert result[0]['pros'] == ['역세권', '학군 우수']


@pytest.mark.asyncio
async def test_score_properties_skips_failed_items():
    props = [
        {'title': '정상 매물', 'price': 50000},
        {'title': '오류 매물', 'price': 30000},
    ]
    call_count = 0

    async def side_effect(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 2:
            raise ValueError('API error')
        msg = MagicMock()
        msg.content = [MagicMock(text=json.dumps(MOCK_SCORE))]
        return msg

    mock_client = AsyncMock()
    mock_client.messages.create = side_effect

    with patch('anthropic.AsyncAnthropic', return_value=mock_client):
        from processors.property_scorer import score_properties
        result = await score_properties(props, 'test-key')

    assert len(result) == 1


@pytest.mark.asyncio
async def test_score_properties_empty_input():
    with patch('anthropic.AsyncAnthropic'):
        from processors.property_scorer import score_properties
        result = await score_properties([], 'test-key')

    assert result == []
