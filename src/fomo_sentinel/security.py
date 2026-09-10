from __future__ import annotations

import asyncio
from typing import Any

import httpx

from .config import Settings
from .models import SecurityVerdict, TokenSnapshot

EVM_CHAIN_IDS = {
    "ethereum": "1",
    "bsc": "56",
    "base": "8453",
    "arbitrum": "42161",
    "optimism": "10",
    "polygon": "137",
    "avalanche": "43114",
    "linea": "59144",
    "zksync": "324",
    "scroll": "534352",
    "mantle": "5000",
    "sei": "1329",
    "monad": "143",
    "robinhoodchain": "4663",
    "robinhood": "4663",
}


class SecurityAnalyzer:
    """Fail-closed chain safety checks. No verdict means no alert."""

    def __init__(self, cfg: Settings) -> None:
        self.cfg = cfg
        self.client = httpx.AsyncClient(timeout=20, headers={"User-Agent": "fomo-sentinel/0.1"})

    async def close(self) -> None:
        await self.client.aclose()

    async def analyze(self, token: TokenSnapshot) -> SecurityVerdict:
        try:
            if token.chain == "solana":
                return await self._rugcheck(token)
            if token.chain in {"robinhoodchain", "robinhood"}:
                goplus, blockscout = await asyncio.gather(
                    self._goplus(token), self._robinhood_blockscout(token), return_exceptions=True
                )
                verdicts = [
                    item for item in (goplus, blockscout) if isinstance(item, SecurityVerdict)
                ]
                return self._combine("GoPlus + Robinhood Blockscout", verdicts)
            if token.chain in EVM_CHAIN_IDS:
                return await self._goplus(token)
        except (httpx.HTTPError, ValueError, TypeError, KeyError) as exc:
            return SecurityVerdict(
                False, False, "security feed", [f"security check failed: {type(exc).__name__}"]
            )
        return SecurityVerdict(False, False, "none", ["no security adapter for chain"])

    async def _rugcheck(self, token: TokenSnapshot) -> SecurityVerdict:
        response = await self.client.get(
            f"{self.cfg.rugcheck_base_url}/tokens/{token.address}/report"
        )
        response.raise_for_status()
        data = response.json()
        reasons: list[str] = []
        positives: list[str] = []
        if data.get("rugged") is True:
            reasons.append("RugCheck marks token as rugged")
        if data.get("mintAuthority"):
            reasons.append("mint authority is active")
        else:
            positives.append("mint authority disabled")
        if data.get("freezeAuthority"):
            reasons.append("freeze authority is active")
        else:
            positives.append("freeze authority disabled")
        for risk in data.get("risks") or []:
            level = str(risk.get("level") or "").lower()
            if level in {"danger", "critical"}:
                reasons.append(
                    str(risk.get("name") or risk.get("description") or "critical contract risk")
                )
        top_percent = self._solana_top_holder_percent(data)
        if top_percent is None:
            reasons.append("top-holder concentration unavailable")
        elif top_percent > self.cfg.max_top_10_holder_percent:
            reasons.append(f"top holders control {top_percent:.1f}%")
        else:
            positives.append(f"top-holder concentration {top_percent:.1f}%")
        return SecurityVerdict(True, not reasons, "RugCheck", reasons, positives, top_percent)

    @staticmethod
    def _solana_top_holder_percent(data: dict[str, Any]) -> float | None:
        values: list[float] = []
        for holder in (data.get("topHolders") or [])[:10]:
            try:
                pct = float(holder.get("pct") or holder.get("percentage") or 0)
                if pct <= 1:
                    pct *= 100
                values.append(pct)
            except (TypeError, ValueError):
                continue
        return sum(values) if values else None

    async def _goplus(self, token: TokenSnapshot) -> SecurityVerdict:
        chain_id = EVM_CHAIN_IDS[token.chain]
        response = await self.client.get(
            f"{self.cfg.goplus_base_url}/token_security/{chain_id}",
            params={"contract_addresses": token.address.lower()},
        )
        response.raise_for_status()
        payload = response.json()
        result = payload.get("result") or {}
        data = result.get(token.address.lower()) or result.get(token.address) or {}
        if not data:
            return SecurityVerdict(False, False, "GoPlus", ["GoPlus returned no token verdict"])
        flags = {
            "is_honeypot": "honeypot behavior detected",
            "cannot_sell_all": "holders may be unable to sell all tokens",
            "is_blacklisted": "blacklist behavior detected",
            "is_proxy": "upgradeable proxy contract",
            "owner_change_balance": "owner can change balances",
            "hidden_owner": "hidden contract owner",
            "selfdestruct": "self-destruct capability detected",
            "transfer_pausable": "transfers can be paused",
            "slippage_modifiable": "tax/slippage can be modified",
        }
        reasons = [message for key, message in flags.items() if str(data.get(key)) == "1"]
        try:
            buy_tax = float(data.get("buy_tax") or 0) * 100
            sell_tax = float(data.get("sell_tax") or 0) * 100
            if buy_tax > 10:
                reasons.append(f"buy tax is {buy_tax:.1f}%")
            if sell_tax > 10:
                reasons.append(f"sell tax is {sell_tax:.1f}%")
        except (TypeError, ValueError):
            reasons.append("token tax could not be verified")
        positives = (
            [] if reasons else ["no critical GoPlus contract flags", "buy/sell taxes within limit"]
        )
        return SecurityVerdict(True, not reasons, "GoPlus", reasons, positives)

    async def _robinhood_blockscout(self, token: TokenSnapshot) -> SecurityVerdict:
        base = self.cfg.robinhood_blockscout_url.rstrip("/")
        token_response, contract_response, holders_response = await asyncio.gather(
            self.client.get(f"{base}/api/v2/tokens/{token.address}"),
            self.client.get(f"{base}/api/v2/smart-contracts/{token.address}"),
            self.client.get(f"{base}/api/v2/tokens/{token.address}/holders"),
        )
        token_response.raise_for_status()
        contract_response.raise_for_status()
        holders_response.raise_for_status()
        token_data = token_response.json()
        contract_data = contract_response.json()
        holders_data = holders_response.json()
        reasons: list[str] = []
        positives: list[str] = []
        if not bool(contract_data.get("is_verified")):
            reasons.append("contract source is not verified on Robinhood Blockscout")
        else:
            positives.append("verified contract source")
        if bool(contract_data.get("is_scam")):
            reasons.append("explorer scam flag")
        try:
            supply = float(token_data.get("total_supply") or 0)
            holder_values = [
                float(item.get("value") or 0) for item in (holders_data.get("items") or [])[:10]
            ]
            top_percent = (
                sum(holder_values) / supply * 100 if supply > 0 and holder_values else None
            )
        except (TypeError, ValueError, ZeroDivisionError):
            top_percent = None
        if top_percent is None:
            reasons.append("Robinhood Chain holder concentration unavailable")
        elif top_percent > self.cfg.max_top_10_holder_percent:
            reasons.append(f"top holders control {top_percent:.1f}%")
        else:
            positives.append(f"top-holder concentration {top_percent:.1f}%")
        return SecurityVerdict(
            True, not reasons, "Robinhood Blockscout", reasons, positives, top_percent
        )

    @staticmethod
    def _combine(provider: str, verdicts: list[SecurityVerdict]) -> SecurityVerdict:
        if not verdicts:
            return SecurityVerdict(False, False, provider, ["all security feeds failed"])
        checked = any(item.checked for item in verdicts)
        reasons = [reason for item in verdicts for reason in item.reasons]
        positives = [positive for item in verdicts for positive in item.positives]
        concentrations = [
            item.top_10_holder_percent
            for item in verdicts
            if item.top_10_holder_percent is not None
        ]
        return SecurityVerdict(
            checked=checked,
            safe=checked and all(item.safe for item in verdicts if item.checked),
            provider=provider,
            reasons=reasons,
            positives=positives,
            top_10_holder_percent=max(concentrations) if concentrations else None,
        )
