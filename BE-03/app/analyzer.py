"""Dependency-free sentiment sample API engine."""

import re

from .schemas import AnalyzeResponse

POSITIVE = {
    "good", "great", "delicious", "awesome", "excellent", "love", "loved",
    "best", "amazing", "fast", "fresh", "happy", "perfect", "tasty", "nice",
}
NEGATIVE = {
    "bad", "awful", "terrible", "slow", "late", "cold", "worst", "hate",
    "disappointing", "rude", "bland", "burnt", "problem", "issue",
}


def analyze_text(text: str) -> AnalyzeResponse:
    words = re.findall(r"[a-z']+", text.lower())
    positive_hits = sum(1 for word in words if word in POSITIVE)
    negative_hits = sum(1 for word in words if word in NEGATIVE)
    score = positive_hits - negative_hits

    if score > 0:
        sentiment = "positive"
    elif score < 0:
        sentiment = "negative"
    else:
        sentiment = "neutral"

    keywords = [word for word in words if word in POSITIVE | NEGATIVE][:5]
    sentences = len([part for part in re.split(r"[.!?]+", text) if part.strip()]) or 1

    return AnalyzeResponse(
        sentiment=sentiment,
        score=round(score / max(1, len(words)) * 10, 3),
        word_count=len(words),
        character_count=len(text),
        sentence_count=sentences,
        keywords=keywords,
    )
