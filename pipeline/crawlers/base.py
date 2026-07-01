from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class RawArticle:
    source: str
    title: str
    url: str
    content: str
    published_at: datetime


@dataclass
class ClassifiedArticle(RawArticle):
    category: str = ""
    regions: list[str] = field(default_factory=list)
    importance: int = 5
    urgent: bool = False
    summary: str = ""
