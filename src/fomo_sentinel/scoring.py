from __future__ import annotations

import math

from .config import Settings
from .models import Evaluation, SecurityVerdict, TokenSnapshot


def _scaled(value: float, floor: float, ceiling: float, points: float) -> float:
    if value <= floor:
        return 0
    if value >= ceiling:
        return points
    return points * (value - floor) / (ceiling - floor)


def evaluate(
    token: TokenSnapshot, cfg: Settings, security: SecurityVerdict | None = None
) -> Evaluation:
    rejects: list[str] = []
    age = token.age_minutes
    if token.liquidity_usd < cfg.min_liquidity_usd:
        rejects.append(f"liquidity ${token.liquidity_usd:,.0f} below ${cfg.min_liquidity_usd:,.0f}")
    if token.volume_h1_usd < cfg.min_hourly_volume_usd:
        rejects.append(f"1h volume ${token.volume_h1_usd:,.0f} below ${cfg.min_hourly_volume_usd:,.0f}")
    if token.market_cap_usd < cfg.min_market_cap_usd:
        rejects.append("market cap below configured floor")
    if token.market_cap_usd > cfg.max_market_cap_usd:
        rejects.append("market cap above configured ceiling")
    if age is None:
        rejects.append("pair age unavailable")
    elif age < cfg.min_pair_age_minutes:
        rejects.append("pair is too new to validate")
    elif age > cfg.max_pair_age_hours * 60:
        rejects.append("pair is outside the new-token window")
    if token.hourly_trades < cfg.min_hourly_trades:
        rejects.append("not enough 1h trades")
    liquidity_ratio = token.liquidity_usd / max(token.market_cap_usd, 1)
    if liquidity_ratio < cfg.min_liquidity_to_mcap:
        rejects.append("liquidity/market-cap ratio too low")
    if token.sells_h1 > token.buys_h1 * 1.35 and token.hourly_trades >= cfg.min_hourly_trades:
        rejects.append("sell pressure dominates")
    if token.price_change_m5 > 120:
        rejects.append("5m move is already parabolic")
    if cfg.require_security_check:
        if security is None or not security.checked:
            rejects.append("security report unavailable")
        elif not security.safe:
            rejects.extend(security.reasons)

    score = 0.0
    positives: list[str] = []
    score += _scaled(math.log10(max(token.liquidity_usd, 1)), 4.3, 6.0, 20)
    score += _scaled(math.log10(max(token.volume_h1_usd, 1)), 4.0, 6.2, 20)
    score += _scaled(token.volume_h1_usd / max(token.liquidity_usd, 1), 0.25, 4, 10)
    score += _scaled(token.hourly_trades, 20, 400, 15)
    score += _scaled(token.buy_ratio, 0.48, 0.70, 15)
    score += _scaled(liquidity_ratio, 0.025, 0.20, 10)
    if 2 <= token.price_change_m5 <= 35:
        score += 5
        positives.append("constructive 5m momentum")
    if 5 <= token.price_change_h1 <= 80:
        score += 5
        positives.append("constructive 1h momentum")
    if token.buy_ratio >= 0.58:
        positives.append(f"buyers are {token.buy_ratio:.0%} of 1h trades")
    if liquidity_ratio >= 0.08:
        positives.append("healthy liquidity relative to market cap")
    if token.volume_h1_usd >= token.liquidity_usd:
        positives.append("1h volume exceeds pool liquidity")
    if security is not None:
        positives.extend(security.positives)

    final_score = max(0, min(100, round(score)))
    status = "rejected" if rejects else ("qualified" if final_score >= cfg.alert_score else "watching")
    return Evaluation(score=final_score, status=status, reasons=rejects, positives=positives)
