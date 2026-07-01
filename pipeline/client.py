import asyncio
import httpx
import logging
from config import Config

logger = logging.getLogger(__name__)


class BackendClient:
    def __init__(self, config: Config):
        self.base_url = config.backend_url
        self.headers = {
            'X-Pipeline-Key': config.pipeline_api_key,
            'Content-Type': 'application/json',
        }

    async def _post(self, path: str, body: dict, retries: int = 3) -> dict:
        url = f'{self.base_url}{path}'
        for attempt in range(retries):
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    res = await client.post(url, json=body, headers=self.headers)
                    res.raise_for_status()
                    return res.json()
            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                logger.warning(f'요청 실패 (시도 {attempt + 1}/{retries}): {e}')
                if attempt == retries - 1:
                    raise
                await asyncio.sleep(2 ** attempt)
        return {}

    async def start_run(self) -> str:
        data = await self._post('/api/pipeline/run/start', {})
        return data['run_id']

    async def finish_run(
        self,
        run_id: str,
        status: str,
        articles_fetched: int = 0,
        articles_saved: int = 0,
        articles_skipped: int = 0,
        error_message: str | None = None,
    ) -> None:
        await self._post('/api/pipeline/run/finish', {
            'run_id': run_id,
            'status': status,
            'articles_fetched': articles_fetched,
            'articles_saved': articles_saved,
            'articles_skipped': articles_skipped,
            'error_message': error_message,
        })

    async def ingest_articles(self, run_id: str, articles: list[dict]) -> dict:
        return await self._post('/api/pipeline/ingest', {
            'run_id': run_id,
            'articles': articles,
        })

    async def save_briefing(
        self,
        run_id: str,
        content: str,
        signal: str,
        signal_reason: str,
        articles_count: int,
        urgent_count: int,
    ) -> None:
        await self._post('/api/pipeline/briefing', {
            'run_id': run_id,
            'content': content,
            'signal': signal,
            'signal_reason': signal_reason,
            'articles_count': articles_count,
            'urgent_count': urgent_count,
        })

    async def ingest_properties(self, run_id: str, properties: list[dict]) -> dict:
        return await self._post('/api/pipeline/properties/ingest', {
            'run_id': run_id,
            'properties': properties,
        })
