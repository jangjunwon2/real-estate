import pytest
from unittest.mock import AsyncMock, MagicMock, patch


def make_kakao_response(places: list[dict]):
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {'documents': places}
    return mock_resp


@pytest.mark.asyncio
async def test_fetch_location_score_with_subway():
    subway = [{'place_name': '마포역', 'distance': '350'}]
    mart = [{'place_name': '이마트', 'distance': '500'}]
    empty = []

    responses = {
        'SW8': subway,
        'SC4': empty,
        'MT1': mart,
        'HP8': empty,
        'PK6': empty,
    }

    async def mock_get(url, **kwargs):
        code = kwargs['params']['category_group_code']
        return make_kakao_response(responses.get(code, []))

    with patch('httpx.AsyncClient') as mock_cls:
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.get = mock_get
        mock_cls.return_value = mock_http

        from processors.location_analyzer import fetch_location_score
        result = await fetch_location_score(37.55, 126.95, 'test-kakao-key')

    assert result['nearest_subway'] == '마포역'
    assert result['nearest_subway_min'] == 5  # ceil(350/70)
    assert result['mart_min'] is not None
    assert result['school_count_1km'] == 0


@pytest.mark.asyncio
async def test_fetch_location_score_no_results():
    async def mock_get(url, **kwargs):
        return make_kakao_response([])

    with patch('httpx.AsyncClient') as mock_cls:
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.get = mock_get
        mock_cls.return_value = mock_http

        from processors.location_analyzer import fetch_location_score
        result = await fetch_location_score(37.55, 126.95, 'test-kakao-key')

    assert result['nearest_subway'] == ''
    assert result['nearest_subway_min'] is None
    assert result['mart_min'] is None
    assert result['school_score'] == 0


@pytest.mark.asyncio
async def test_fetch_location_score_handles_api_error():
    import httpx

    async def mock_get(url, **kwargs):
        raise httpx.RequestError('network error')

    with patch('httpx.AsyncClient') as mock_cls:
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.get = mock_get
        mock_cls.return_value = mock_http

        from processors.location_analyzer import fetch_location_score
        result = await fetch_location_score(37.55, 126.95, 'test-kakao-key')

    assert result['nearest_subway'] == ''
    assert result['school_score'] == 0
