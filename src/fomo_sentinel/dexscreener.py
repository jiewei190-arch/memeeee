from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

import httpx

from .models import TokenSnapshot


class DexScreenerClient:
    base_url = "https://api.dexscreener.com"

    def __init__(self, chains: list[str]) -> None:
        self.chains = set(chains)
        self.client = httpx.AsyncClient(timeout=15, headers={"User-Agent": "fomo-sentinel/0.1"})

    async def close(self) -> None:
        await self.client.aclose()

    async def _get_json(self, path: str) -> Any:
        response = await self.client.get(f"{self.base_url}{path}")
        response.raise_for_status()
        return response.json()

    async def discover(self) -> tuple[list[TokenSnapshot], set[str]]:
        sources = await asyncio.gather(
            self._get_json("/token-profiles/latest/v1"),
            self._get_json("/token-boosts/latest/v1"),
            self._get_json("/token-boosts/top/v1"),
            return_exceptions=True,
        )
        addresses: dict[str, set[str]] = {chain: set() for chain in self.chains}
        source_failures: set[str] = set()
        for index, payload in enumerate(sources):
            if isinstance(payload, Exception):
                source_failures.add(f"discovery_source_{index}")
                continue
            for item in payload or []:
                chain = str(item.get("chainId", "")).lower()
                address = str(item.get("tokenAddress", ""))
                if chain in addresses and address:
                    addresses[chain].add(address)

        snapshots: list[TokenSnapshot] = []
        seen_pairs: set[tuple[str, str]] = set()
        for chain, chain_addresses in addresses.items():
            chunks = [list(chain_addresses)[i : i + 30] for i in range(0, len(chain_addresses), 30)]
            if not chunks:
                continue
            results = await asyncio.gather(
                *(self._get_json(f"/tokens/v1/{chain}/{','.join(chunk)}") for chunk in chunks),
                return_exceptions=True,
            )
            for payload in results:
                if isinstance(payload, Exception):
                    source_failures.add(chain)
                    continue
                for pair in payload or []:
                    parsed = self._parse_pair(pair)
                    if parsed and (parsed.chain, parsed.pair_address) not in seen_pairs:
                        snapshots.append(parsed)
                        seen_pairs.add((parsed.chain, parsed.pair_address))
        return snapshots, source_failures

    async def fetch_token(
        self, chain: str, address: str, pair_address: str = ""
    ) -> TokenSnapshot | None:
        payload = await self._get_json(f"/tokens/v1/{chain}/{address}")
        parsed = [item for item in (self._parse_pair(pair) for pair in payload or []) if item]
        if pair_address:
            exact = next((item for item in parsed if item.pair_address == pair_address), None)
            if exact:
                return exact
        return max(parsed, key=lambda item: item.liquidity_usd, default=None)

    @staticmethod
    def _number(value: Any) -> float:
        try:
            return float(value or 0)
        except (TypeError, ValueError):
            return 0.0

    def _parse_pair(self, pair: dict[str, Any]) -> TokenSnapshot | None:
        base = pair.get("baseToken") or {}
        address = str(base.get("address") or "")
        pair_address = str(pair.get("pairAddress") or "")
        if not address or not pair_address:
            return None
        created_ms = pair.get("pairCreatedAt")
        created_at = None
        if created_ms:
            try:
                created_at = datetime.fromtimestamp(float(created_ms) / 1000, tz=UTC)
            except (ValueError, TypeError, OSError):
                pass
        txns = (pair.get("txns") or {}).get("h1") or {}
        price_change = pair.get("priceChange") or {}
        market_cap = self._number(pair.get("marketCap")) or self._number(pair.get("fdv"))
        return TokenSnapshot(
            chain=str(pair.get("chainId") or "unknown").lower(),
            address=address,
            symbol=str(base.get("symbol") or "UNKNOWN")[:24],
            name=str(base.get("name") or "Unknown")[:80],
            pair_address=pair_address,
            dex=str(pair.get("dexId") or "unknown"),
            url=str(pair.get("url") or ""),
            price_usd=self._number(pair.get("priceUsd")),
            liquidity_usd=self._number((pair.get("liquidity") or {}).get("usd")),
            market_cap_usd=market_cap,
            volume_h1_usd=self._number((pair.get("volume") or {}).get("h1")),
            buys_h1=int(txns.get("buys") or 0),
            sells_h1=int(txns.get("sells") or 0),
            price_change_m5=self._number(price_change.get("m5")),
            price_change_h1=self._number(price_change.get("h1")),
            pair_created_at=created_at,
            source="dexscreener",
        )
