from datetime import UTC, datetime, timedelta

from fomo_sentinel.config import Settings
from fomo_sentinel.models import SecurityVerdict, TokenSnapshot
from fomo_sentinel.scoring import evaluate


def token(**overrides):
    values = {
        "chain": "solana",
        "address": "mint",
        "symbol": "MEME",
        "name": "Meme",
        "pair_address": "pair",
        "dex": "raydium",
        "url": "https://dexscreener.com/solana/pair",
        "price_usd": 0.001,
        "liquidity_usd": 150_000,
        "market_cap_usd": 800_000,
        "volume_h1_usd": 300_000,
        "buys_h1": 260,
        "sells_h1": 120,
        "price_change_m5": 12,
        "price_change_h1": 45,
        "pair_created_at": datetime.now(UTC) - timedelta(hours=3),
    }
    values.update(overrides)
    return TokenSnapshot(**values)


def test_strong_candidate_qualifies():
    safety = SecurityVerdict(True, True, "test", positives=["safe"])
    result = evaluate(token(), Settings(database_path=":memory:"), safety)
    assert result.status == "qualified"
    assert result.score >= 76


def test_thin_liquidity_is_rejected():
    result = evaluate(token(liquidity_usd=2_000), Settings(database_path=":memory:"))
    assert result.status == "rejected"
    assert any("liquidity" in reason for reason in result.reasons)


def test_parabolic_five_minute_move_is_rejected():
    result = evaluate(token(price_change_m5=250), Settings(database_path=":memory:"))
    assert result.status == "rejected"
    assert any("parabolic" in reason for reason in result.reasons)


def test_missing_security_report_fails_closed():
    result = evaluate(token(), Settings(database_path=":memory:"))
    assert result.status == "rejected"
    assert "security report unavailable" in result.reasons
