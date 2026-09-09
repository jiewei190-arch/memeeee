from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime


@dataclass(slots=True)
class TokenSnapshot:
    chain: str
    address: str
    symbol: str
    name: str
    pair_address: str
    dex: str
    url: str
    price_usd: float
    liquidity_usd: float
    market_cap_usd: float
    volume_h1_usd: float
    buys_h1: int
    sells_h1: int
    price_change_m5: float
    price_change_h1: float
    pair_created_at: datetime | None
    discovered_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @property
    def hourly_trades(self) -> int:
        return self.buys_h1 + self.sells_h1

    @property
    def buy_ratio(self) -> float:
        return self.buys_h1 / max(self.hourly_trades, 1)

    @property
    def age_minutes(self) -> float | None:
        if self.pair_created_at is None:
            return None
        return max((self.discovered_at - self.pair_created_at).total_seconds() / 60, 0)


@dataclass(slots=True)
class Evaluation:
    score: int
    status: str
    reasons: list[str]
    positives: list[str]


@dataclass(slots=True)
class SecurityVerdict:
    checked: bool
    safe: bool
    provider: str
    reasons: list[str] = field(default_factory=list)
    positives: list[str] = field(default_factory=list)
    top_10_holder_percent: float | None = None
