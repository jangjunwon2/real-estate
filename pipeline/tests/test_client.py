import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.fixture
def config():
    cfg = MagicMock()
    cfg.backend_url = 'https://example.vercel.app'
    cfg.pipeline_api_key = 'test-key-123'
    return cfg


@pytest.fixture
def client(config):
    from client import BackendClient
    return BackendClient(config)


@pytest.mark.asyncio
async def test_start_run_returns_run_id(client):
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {'run_id': 'abc-123', 'started_at': '2025-01-01T00:00:00Z'}

    with patch('httpx.AsyncClient') as mock_cls:
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(return_value=mock_response)
        mock_cls.return_value = mock_http

        run_id = await client.start_run()

    assert run_id == 'abc-123'


@pytest.mark.asyncio
async def test_ingest_articles_returns_saved_count(client):
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {'saved': 5, 'skipped': 2, 'run_id': 'abc-123'}

    with patch('httpx.AsyncClient') as mock_cls:
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(return_value=mock_response)
        mock_cls.return_value = mock_http

        result = await client.ingest_articles(run_id='abc-123', articles=[{'title': 'test'}])

    assert result['saved'] == 5


@pytest.mark.asyncio
async def test_finish_run_sends_correct_payload(client):
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {'ok': True}

    with patch('httpx.AsyncClient') as mock_cls:
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(return_value=mock_response)
        mock_cls.return_value = mock_http

        await client.finish_run(
            run_id='abc-123', status='success',
            articles_fetched=10, articles_saved=8, articles_skipped=2,
        )

        call_args = mock_http.post.call_args
        body = call_args.kwargs['json']

    assert body['run_id'] == 'abc-123'
    assert body['status'] == 'success'
    assert body['articles_fetched'] == 10


@pytest.mark.asyncio
async def test_post_retries_on_failure(client):
    import httpx

    mock_success = MagicMock()
    mock_success.raise_for_status = MagicMock()
    mock_success.json.return_value = {'run_id': 'abc-123', 'started_at': '2025-01-01T00:00:00Z'}

    call_count = 0

    async def flaky_post(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count < 2:
            raise httpx.RequestError('timeout')
        return mock_success

    with patch('httpx.AsyncClient') as mock_cls:
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = flaky_post
        mock_cls.return_value = mock_http

        with patch('asyncio.sleep', new_callable=AsyncMock):
            run_id = await client.start_run()

    assert run_id == 'abc-123'
    assert call_count == 2
