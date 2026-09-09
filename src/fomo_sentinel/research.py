from __future__ import annotations

import re
from typing import Any

import httpx

from .config import Settings
from .models import ResearchVerdict, TokenSnapshot


class SocialResearcher:
    """Fast public-web enrichment; results support but never override safety gates."""

    def __init__(self, cfg: Settings) -> None:
        self.cfg = cfg
        self.client = httpx.AsyncClient(timeout=12, headers={"User-Agent": cfg.reddit_user_agent})

    async def close(self) -> None:
        await self.client.aclose()

    async def research(self, token: TokenSnapshot) -> ResearchVerdict:
        if not self.cfg.social_search_enabled:
            return ResearchVerdict(False, "social research disabled")
        if not self.cfg.brave_search_api_key:
            return ResearchVerdict(False, "web-search key not configured")
        query = f'"{token.address}" OR "${token.symbol}" crypto token'
        response = await self.client.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={"q": query, "count": self.cfg.social_search_result_limit, "freshness": "pd"},
            headers={"X-Subscription-Token": self.cfg.brave_search_api_key},
        )
        response.raise_for_status()
        results = ((response.json().get("web") or {}).get("results") or [])
        return self._summarize(results, token)

    def _summarize(self, results: list[dict[str, Any]], token: TokenSnapshot) -> ResearchVerdict:
        x_count = 0
        reddit_count = 0
        warnings: list[str] = []
        positives: list[str] = []
        sources: list[str] = []
        hype_terms = re.compile(
            r"\b(100x|1000x|guaranteed|easy money|ape now|can't lose)\b", re.IGNORECASE
        )
        scam_terms = re.compile(
            r"\b(rug|honeypot|scam|can't sell|drainer)\b", re.IGNORECASE
        )
        address_hits = 0
        for item in results:
            url = str(item.get("url") or "")
            text = f"{item.get('title', '')} {item.get('description', '')}"
            lowered_url = url.lower()
            if "x.com/" in lowered_url or "twitter.com/" in lowered_url:
                x_count += 1
            if "reddit.com/" in lowered_url:
                reddit_count += 1
            if token.address.lower() in text.lower() or token.address.lower() in lowered_url:
                address_hits += 1
            if scam_terms.search(text):
                warnings.append("public results contain scam/rug warnings")
            if hype_terms.search(text):
                warnings.append("coordinated or unrealistic promotional language detected")
            if url and url not in sources:
                sources.append(url)
        if address_hits >= 3:
            positives.append(f"contract address appears in {address_hits} fresh results")
        if x_count >= 2:
            positives.append(f"fresh X discussion found in {x_count} results")
        if reddit_count:
            positives.append(f"fresh Reddit discussion found in {reddit_count} results")
        summary = (
            f"{len(results)} fresh web results; {x_count} X; {reddit_count} Reddit; "
            f"{address_hits} exact contract matches"
        )
        return ResearchVerdict(
            checked=True,
            summary=summary,
            x_mentions=x_count,
            reddit_mentions=reddit_count,
            web_mentions=len(results),
            positive_signals=list(dict.fromkeys(positives)),
            warnings=list(dict.fromkeys(warnings)),
            sources=sources[:5],
        )
