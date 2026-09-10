from __future__ import annotations

import asyncio

import httpx

from .config import Settings
from .dexscreener import DexScreenerClient
from .geckoterminal import GeckoTerminalClient
from .models import TokenSnapshot


class MarketFeed:
    def __init__(self, cfg: Settings) -> None:
        self.dex = DexScreenerClient(cfg.chains)
        self.gecko = GeckoTerminalClient(cfg.chains, cfg.geckoterminal_networks_per_scan)
        self.gecko_enabled = cfg.geckoterminal_enabled

    async def close(self) -> None:
        await asyncio.gather(self.dex.close(), self.gecko.close())

    async def discover(self) -> tuple[list[TokenSnapshot], set[str]]:
        gecko_call = self.gecko.discover() if self.gecko_enabled else self._empty()
        dex_result, gecko_result = await asyncio.gather(self.dex.discover(), gecko_call)
        tokens = dex_result[0] + gecko_result[0]
        failures = {f"dexscreener:{item}" for item in dex_result[1]} | gecko_result[1]
        unique: dict[tuple[str, str], TokenSnapshot] = {}
        for token in tokens:
            key = (token.chain, token.pair_address.lower())
            current = unique.get(key)
            if current is None or token.source == "dexscreener":
                unique[key] = token
        return list(unique.values()), failures

    async def fetch_token(
        self, chain: str, address: str, pair_address: str = ""
    ) -> TokenSnapshot | None:
        try:
            token = await self.dex.fetch_token(chain, address, pair_address)
            if token:
                return token
        except (httpx.HTTPError, ValueError, TypeError):
            # A provider miss must not prevent the secondary price feed.
            pass
        return await self.gecko.fetch_pool(chain, pair_address) if self.gecko_enabled else None

    @staticmethod
    async def _empty() -> tuple[list[TokenSnapshot], set[str]]:
        return [], set()

    def status(self) -> dict[str, object]:
        return {
            "dexscreener": {
                "mode": "5-second polling",
                "scope": "latest profiles and boosted tokens",
            },
            "geckoterminal": {
                "enabled": self.gecko_enabled,
                "mode": "rate-limited rotating new-pool polling",
                "networks": self.gecko.rotation,
                "last_polled": self.gecko.last_networks,
            },
            "birdeye": {"mode": "key stored; adapter pending", "streaming": False},
        }
