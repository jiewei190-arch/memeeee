from __future__ import annotations

import asyncio
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

        # Search the exact contract separately from social domains. Keeping the
        # address in every query sharply reduces false matches from reused meme
        # tickers, while separate X and Reddit searches prevent general web
        # results from crowding social posts out of the result limit.
        address = token.address.replace('"', "")
        symbol = token.symbol.replace('"', "")
        name = token.name.replace('"', "")
        queries = [
            f'"{address}" crypto token',
            f'site:x.com ("{address}" OR ("{name}" "${symbol}")) crypto',
            f'site:reddit.com ("{address}" OR ("{name}" "${symbol}")) crypto',
        ]
        responses = await asyncio.gather(
            *(self._search(query) for query in queries), return_exceptions=True
        )
        results: list[dict[str, Any]] = []
        failures = 0
        seen_urls: set[str] = set()
        for response in responses:
            if isinstance(response, Exception):
                failures += 1
                continue
            for item in response:
                url = str(item.get("url") or "")
                dedupe_key = url or f"{item.get('title', '')}:{item.get('description', '')}"
                if dedupe_key in seen_urls:
                    continue
                seen_urls.add(dedupe_key)
                results.append(item)
        verdict = self._summarize(results, token)
        if failures:
            verdict.warnings.append(f"{failures} of 3 web research queries failed")
            verdict.summary += f"; {3 - failures}/3 searches completed"
        else:
            verdict.summary += "; 3/3 searches completed"
        return verdict

    async def _search(self, query: str) -> list[dict[str, Any]]:
        response = await self.client.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={
                "q": query,
                "count": self.cfg.social_search_result_limit,
                "freshness": "pd",
            },
            headers={"X-Subscription-Token": self.cfg.brave_search_api_key},
        )
        response.raise_for_status()
        return (response.json().get("web") or {}).get("results") or []

    def _summarize(self, results: list[dict[str, Any]], token: TokenSnapshot) -> ResearchVerdict:
        x_count = 0
        reddit_count = 0
        warnings: list[str] = []
        positives: list[str] = []
        sources: list[str] = []
        hype_terms = re.compile(
            r"\b(100x|1000x|guaranteed|easy money|ape now|can't lose)\b", re.IGNORECASE
        )
        scam_terms = re.compile(r"\b(rug|honeypot|scam|can't sell|drainer)\b", re.IGNORECASE)
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
