import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from datetime import datetime
from crawlers.base import RawArticle
from processors.dedup import deduplicate, filter_real_estate


def make_article(url: str, title: str = '', content: str = '') -> RawArticle:
    return RawArticle(
        source='test', title=title or url,
        url=url, content=content,
        published_at=datetime.now(),
    )


class TestDeduplicate:
    def test_removes_duplicate_urls(self):
        articles = [
            make_article('https://example.com/a'),
            make_article('https://example.com/a'),
            make_article('https://example.com/b'),
        ]
        result = deduplicate(articles)
        assert len(result) == 2

    def test_preserves_order(self):
        urls = ['https://a.com', 'https://b.com', 'https://c.com']
        result = deduplicate([make_article(u) for u in urls])
        assert [a.url for a in result] == urls

    def test_empty_list(self):
        assert deduplicate([]) == []

    def test_all_unique(self):
        articles = [make_article(f'https://example.com/{i}') for i in range(5)]
        assert len(deduplicate(articles)) == 5

    def test_keeps_first_occurrence(self):
        a1 = make_article('https://dup.com', title='첫 번째')
        a2 = make_article('https://dup.com', title='두 번째')
        result = deduplicate([a1, a2])
        assert result[0].title == '첫 번째'


class TestFilterRealEstate:
    def test_keeps_real_estate_articles(self):
        articles = [
            make_article('https://a.com', title='아파트 매매 동향'),
            make_article('https://b.com', title='금리 인상 전망'),
            make_article('https://c.com', title='오늘의 날씨'),
        ]
        result = filter_real_estate(articles)
        assert len(result) == 2

    def test_checks_content_too(self):
        article = make_article('https://a.com', title='오늘 뉴스', content='전세 시장이 안정세를 보이고 있다')
        result = filter_real_estate([article])
        assert len(result) == 1

    def test_empty_list(self):
        assert filter_real_estate([]) == []

    def test_all_irrelevant(self):
        articles = [make_article(f'https://x.com/{i}', title='스포츠 뉴스') for i in range(3)]
        assert filter_real_estate(articles) == []

    def test_case_insensitive_check(self):
        article = make_article('https://a.com', title='LTV 규제 완화 전망')
        result = filter_real_estate([article])
        assert len(result) == 1
