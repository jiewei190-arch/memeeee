from datetime import UTC

import pytest

from fomo_sentinel.geckoterminal import GeckoTerminalClient


@pytest.mark.asyncio
async def test_parses_new_pool_payload():
    client = GeckoTerminalClient(["robinhoodchain"])
    payload = {
        "data": [
            {
                "attributes": {
                    "address": "0xpair",
                    "name": "MEME / WETH",
                    "pool_created_at": "2026-09-10T03:57:56Z",
                    "base_token_price_usd": "0.001",
                    "reserve_in_usd": "50000",
                    "fdv_usd": "400000",
                    "price_change_percentage": {"m5": "4", "h1": "20"},
                    "transactions": {"h1": {"buys": 40, "sells": 10}},
                    "volume_usd": {"h1": "90000"},
                },
                "relationships": {
                    "base_token": {"data": {"id": "robinhood_0xtoken"}},
                    "dex": {"data": {"id": "test-dex"}},
                },
            }
        ],
        "included": [
            {
                "id": "robinhood_0xtoken",
                "attributes": {"address": "0xtoken", "name": "Meme Coin", "symbol": "MEME"},
            }
        ],
    }
    try:
        tokens = client._parse_payload(payload, "robinhoodchain", "robinhood")
    finally:
        await client.close()
    assert len(tokens) == 1
    token = tokens[0]
    assert token.chain == "robinhoodchain"
    assert token.address == "0xtoken"
    assert token.source == "geckoterminal"
    assert token.buys_h1 == 40
    assert token.pair_created_at is not None
    assert token.pair_created_at.tzinfo == UTC
