import asyncio
import logging
import httpx
from datetime import datetime
from config import load_config
from client import BackendClient
from crawlers.naver_news import fetch_naver_news
from crawlers.public_apis import fetch_molit_transactions, fetch_bok_rate, fetch_subscriptions
from crawlers.rss import fetch_rss
from crawlers.onbid import fetch_onbid
from crawlers.court_auction import fetch_court_auctions
from crawlers.base import ClassifiedArticle
from processors.dedup import deduplicate, filter_real_estate
from processors.classifier import classify_articles
from processors.briefing_generator import generate_briefing
from processors.property_scorer import score_properties
from notifiers.email_notifier import send_briefing_email
from notifiers.kakao import send_urgent_alert, send_property_alert

logger = logging.getLogger(__name__)


async def crawl_all_sources(config) -> list:
    results = await asyncio.gather(
        fetch_naver_news(config),
        fetch_molit_transactions(config),
        fetch_bok_rate(config),
        fetch_subscriptions(config),
        fetch_rss(config),
        fetch_onbid(config),
        fetch_court_auctions(config),
        return_exceptions=True,
    )
    articles = []
    for r in results:
        if isinstance(r, Exception):
            logger.warning(f'크롤러 실패: {r}')
        elif r:
            articles.extend(r)
    return articles


async def process_properties(config, backend: BackendClient, run_id: str) -> list[dict]:
    raw_results = await asyncio.gather(
        fetch_onbid(config),
        fetch_court_auctions(config),
        fetch_subscriptions(config),
        return_exceptions=True,
    )
    all_props = []
    for r in raw_results:
        if not isinstance(r, Exception) and r:
            all_props.extend([{'raw': p.__dict__} for p in r])
    if not all_props:
        return []
    scored = await score_properties(
        all_props, config.anthropic_api_key,
        config.user_region, config.user_budget_max,
    )
    try:
        await backend.ingest_properties(run_id=run_id, properties=scored)
    except Exception as e:
        logger.warning(f'매물 저장 실패: {e}')
    return scored


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    config = load_config()
    backend = BackendClient(config)

    run_id = await backend.start_run()
    logger.info(f'파이프라인 시작: run_id={run_id}')

    fetched = saved = skipped = 0
    try:
        # Anthropic API 키 및 연결 진단
        api_key = config.anthropic_api_key
        logger.info(f'ANTHROPIC_API_KEY: 길이={len(api_key)}, 시작={api_key[:8] if api_key else "없음"}')
        try:
            async with httpx.AsyncClient(timeout=5) as test_client:
                r = await test_client.get('https://api.anthropic.com/')
                logger.info(f'Anthropic 연결 테스트: {r.status_code}')
        except Exception as conn_err:
            logger.warning(f'Anthropic API 연결 불가: {conn_err}')

        raw = await crawl_all_sources(config)
        fetched = len(raw)
        filtered = filter_real_estate(deduplicate(raw))
        skipped = fetched - len(filtered)
        logger.info(f'크롤링: 수집={fetched}, 필터후={len(filtered)}')

        classified = await classify_articles(filtered, config.anthropic_api_key)
        if not classified and filtered:
            logger.warning(f'AI 분류 실패, {len(filtered)}개 기사를 기본값(기타)으로 저장')
            classified = [ClassifiedArticle(
                source=a.source, title=a.title, url=a.url,
                content=a.content, published_at=a.published_at,
            ) for a in filtered]

        def to_dict(c) -> dict:
            d = {**c.__dict__}
            if isinstance(d.get('published_at'), datetime):
                d['published_at'] = d['published_at'].isoformat()
            return d

        result = await backend.ingest_articles(
            run_id=run_id,
            articles=[to_dict(c) for c in classified],
        )
        saved = result.get('saved', 0)

        serialized = [to_dict(c) for c in classified]
        scored_props, briefing = await asyncio.gather(
            process_properties(config, backend, run_id),
            generate_briefing(serialized, config.anthropic_api_key),
        )

        await backend.save_briefing(
            run_id=run_id,
            content=briefing['content'],
            signal=briefing['signal'],
            signal_reason=briefing.get('signal_reason', ''),
            articles_count=len(classified),
            urgent_count=sum(1 for c in classified if getattr(c, 'urgent', False)),
        )

        await send_briefing_email(config, briefing['content'], signal=briefing['signal'])

        urgent = [d for d in serialized if d.get('urgent')]
        if urgent:
            await send_urgent_alert(config, urgent)

        top = sorted(scored_props, key=lambda x: x.get('total_score', 0), reverse=True)[:3]
        if top:
            await send_property_alert(config, top)

        await backend.finish_run(
            run_id=run_id, status='success',
            articles_fetched=fetched, articles_saved=saved, articles_skipped=skipped,
        )
        logger.info(f'파이프라인 완료: 수집={fetched}, 저장={saved}, 스킵={skipped}')

    except Exception as e:
        logger.error(f'파이프라인 실패: {e}', exc_info=True)
        await backend.finish_run(run_id=run_id, status='failed', error_message=str(e))
        raise


if __name__ == '__main__':
    asyncio.run(main())
