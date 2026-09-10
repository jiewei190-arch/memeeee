from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

import httpx

from .models import TokenSnapshot

NETWORK_IDS = {
    "solana": "solana",
    "ethereum": "eth",
    "base": "base",
    "bsc": "bsc",
    "arbitrum": "arbitrum",
    "optimism": "optimism",
    "polygon": "polygon_pos",
    "avalanche": "avax",
    "linea": "linea",
    "zksync": "zksync",
    "scroll": "scroll",
    "mantle": "mantle",
    "sei": "sei-evm",
    "sui": "sui-network",
    "aptos": "aptos",
    "ton": "ton",
    "monad": "monad",
    "robinhoodchain": "robinhood",
}


class GeckoTerminalClient:
    base_url = "https://api.geckoterminal.com/api/v2"

    def __init__(self, chains: list[str], networks_per_scan: int = 2) -> None:
        configured = [chain for chain in chains if chain in NETWORK_IDS]
        priority = [chain for chain in ("solana", "robinhoodchain") if chain in configured]
        self.rotation = priority + configured
        self.networks_per_scan = min(max(networks_per_scan, 1), 3)
        self.position = 0
        self.last_networks: list[str] = []
        self.client = httpx.AsyncClient(
            timeout=15,
            headers={"User-Agent": "memeeee/0.2", "Accept": "application/json"},
        )

    async def close(self) -> None:
        await self.client.aclose()

    async def discover(self) -> tuple[list[TokenSnapshot], set[str]]:
        if not self.rotation:
            return [], set()
        selected = [
            self.rotation[(self.position + i) % len(self.rotation)]
            for i in range(self.networks_per_scan)
        ]
        self.position = (self.position + self.networks_per_scan) % len(self.rotation)
        self.last_networks = selected
        results = await asyncio.gather(
            *(self._new_pools(chain) for chain in selected), return_exceptions=True
        )
        snapshots: list[TokenSnapshot] = []
        failures: set[str] = set()
        for chain, result in zip(selected, results, strict=True):
            if isinstance(result, Exception):
                failures.add(f"geckoterminal:{chain}")
            else:
                snapshots.extend(result)
        return snapshots, failures

    async def _new_pools(self, chain: str) -> list[TokenSnapshot]:
        network_id = NETWORK_IDS[chain]
        response = await self.client.get(
            f"{self.base_url}/networks/{network_id}/new_pools",
            params={"page": 1, "include": "base_token"},
        )
        response.raise_for_status()
        payload = response.json()
        return self._parse_payload(payload, chain, network_id)

    async def fetch_pool(self, chain: str, pair_address: str) -> TokenSnapshot | None:
        network_id = NETWORK_IDS.get(chain)
        if not network_id or not pair_address:
            return None
        response = await self.client.get(
            f"{self.base_url}/networks/{network_id}/pools/{pair_address}",
            params={"include": "base_token"},
        )
        response.raise_for_status()
        parsed = self._parse_payload(response.json(), chain, network_id)
        return parsed[0] if parsed else None

    def _parse_payload(
        self, payload: dict[str, Any], chain: str, network_id: str
    ) -> list[TokenSnapshot]:
        included = {
            str(item.get("id")): item.get("attributes") or {}
            for item in payload.get("included") or []
        }
        raw_data = payload.get("data") or []
        pools = raw_data if isinstance(raw_data, list) else [raw_data]
        parsed: list[TokenSnapshot] = []
        for pool in pools:
            attributes = pool.get("attributes") or {}
            relationships = pool.get("relationships") or {}
            token_ref = ((relationships.get("base_token") or {}).get("data")) or {}
            token_id = str(token_ref.get("id") or "")
            token_attributes = included.get(token_id, {})
            address = str(token_attributes.get("address") or "")
            if not address and token_id.startswith(f"{network_id}_"):
                address = token_id[len(network_id) + 1 :]
            pair_address = str(attributes.get("address") or "")
            if not address or not pair_address:
                continue
            name_parts = str(attributes.get("name") or "Unknown / Unknown").split(" / ", 1)
            created_at = self._datetime(attributes.get("pool_created_at"))
            transactions = (attributes.get("transactions") or {}).get("h1") or {}
            changes = attributes.get("price_change_percentage") or {}
            volumes = attributes.get("volume_usd") or {}
            market_cap = self._number(attributes.get("market_cap_usd")) or self._number(
                attributes.get("fdv_usd")
            )
            dex_id = str(
                (((relationships.get("dex") or {}).get("data")) or {}).get("id") or "unknown"
            )
            parsed.append(
                TokenSnapshot(
                    chain=chain,
                    address=address,
                    symbol=str(token_attributes.get("symbol") or name_parts[0])[:24],
                    name=str(token_attributes.get("name") or name_parts[0])[:80],
                    pair_address=pair_address,
                    dex=dex_id,
                    url=f"https://www.geckoterminal.com/{network_id}/pools/{pair_address}",
                    price_usd=self._number(attributes.get("base_token_price_usd")),
                    liquidity_usd=self._number(attributes.get("reserve_in_usd")),
                    market_cap_usd=market_cap,
                    volume_h1_usd=self._number(volumes.get("h1")),
                    buys_h1=int(transactions.get("buys") or 0),
                    sells_h1=int(transactions.get("sells") or 0),
                    price_change_m5=self._number(changes.get("m5")),
                    price_change_h1=self._number(changes.get("h1")),
                    pair_created_at=created_at,
                    source="geckoterminal",
                )
            )
        return parsed

    @staticmethod
    def _number(value: Any) -> float:
        try:
            return float(value or 0)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _datetime(value: Any) -> datetime | None:
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(str(value))
            return parsed.astimezone(UTC)
        except (TypeError, ValueError):
            return None
