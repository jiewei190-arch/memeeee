from datetime import UTC, datetime

import pytest

from fomo_sentinel.config import Settings
from fomo_sentinel.models import TokenSnapshot
from fomo_sentinel.research import SocialResearcher


class FakeResponse:
    def __init__(self, results):
        self.results = results

    def raise_for_status(self):
        return None

    def json(self):
        return {"web": {"results": self.results}}


class FakeClient:
    def __init__(self):
        self.queries = []

    async def get(self, _url, params, headers):
        self.queries.append(params["q"])
        address = "0xabc123"
        if "site:x.com" in params["q"]:
            return FakeResponse(
                [{"url": "https://x.com/trader/status/1", "title": address, "description": ""}]
            )
        if "site:reddit.com" in params["q"]:
            return FakeResponse(
                [
                    {
                        "url": "https://reddit.com/r/coins/comments/1",
                        "title": address,
                        "description": "community discussion",
                    }
                ]
            )
        return FakeResponse(
            [{"url": "https://example.com/token", "title": address, "description": "token"}]
        )

    async def aclose(self):
        return None


@pytest.mark.asyncio
async def test_research_runs_web_x_and_reddit_queries():
    cfg = Settings(brave_search_api_key="test-key")
    researcher = SocialResearcher(cfg)
    await researcher.client.aclose()
    fake = FakeClient()
    researcher.client = fake
    token = TokenSnapshot(
        chain="base",
        address="0xabc123",
        symbol="MEME",
        name="Meme Coin",
        pair_address="0xpair",
        dex="test",
        url="https://example.com/chart",
        price_usd=0.01,
        liquidity_usd=50_000,
        market_cap_usd=500_000,
        volume_h1_usd=100_000,
        buys_h1=100,
        sells_h1=30,
        price_change_m5=5,
        price_change_h1=20,
        pair_created_at=datetime.now(UTC),
    )

    verdict = await researcher.research(token)

    assert verdict.checked is True
    assert len(fake.queries) == 3
    assert any("site:x.com" in query for query in fake.queries)
    assert any("site:reddit.com" in query for query in fake.queries)
    assert verdict.x_mentions == 1
    assert verdict.reddit_mentions == 1
    assert verdict.web_mentions == 3
    assert "3/3 searches completed" in verdict.summary
