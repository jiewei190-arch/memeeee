from __future__ import annotations

import httpx

from .models import Evaluation, ResearchVerdict, TokenSnapshot


class SlackNotifier:
    def __init__(self, webhook_url: str) -> None:
        self.webhook_url = webhook_url
        self.client = httpx.AsyncClient(timeout=15)

    async def close(self) -> None:
        await self.client.aclose()

    async def send(self, text: str) -> bool:
        if not self.webhook_url:
            return False
        response = await self.client.post(self.webhook_url, json={"text": text})
        response.raise_for_status()
        return True

    async def flash_alert(self, token: TokenSnapshot, result: Evaluation) -> bool:
        return await self.send(
            f"⚡ *MEMEEEE FLASH WATCH — {token.chain.upper()}* `{result.score}/100`\n"
            f"*{token.name} ({token.symbol})* just triggered the live market filter.\n"
            f"Liquidity: `${token.liquidity_usd:,.0f}` | 1h volume: `${token.volume_h1_usd:,.0f}` | "
            f"5m: `{token.price_change_m5:+.1f}%`\n"
            f"Contract: `{token.address}`\nChart: {token.url}\n"
            "⏳ Contract, holders, and social research are running. *This flash is not approval.*"
        )

    async def alert(
        self, token: TokenSnapshot, result: Evaluation, research: ResearchVerdict | None = None
    ) -> bool:
        positives = "\n".join(f"• {item}" for item in result.positives[:4]) or "• Passed configured gates"
        chain_names = {
            "solana": "🟣 SOLANA",
            "robinhoodchain": "🟢 ROBINHOOD CHAIN",
            "robinhood": "🟢 ROBINHOOD CHAIN",
            "ethereum": "🔵 ETHEREUM",
            "base": "🔷 BASE",
            "bsc": "🟡 BNB CHAIN",
            "monad": "🟪 MONAD",
        }
        chain_label = chain_names.get(token.chain, token.chain.upper())
        social = "Social research unavailable"
        warnings = "none detected"
        sources = ""
        if research and research.checked:
            social = research.summary
            warnings = "; ".join(research.warnings) or "none detected"
            sources = "\n" + "\n".join(f"• {url}" for url in research.sources[:3])
        text = (
            f"🚨 *FOMO SENTINEL — 1–2 DAY BREAKOUT CANDIDATE* `{result.score}/100`\n"
            f"*Category: {chain_label}*\n"
            f"*{token.name} ({token.symbol})* · {token.dex}\n"
            f"Price: `${token.price_usd:.10g}` | MC: `${token.market_cap_usd:,.0f}`\n"
            f"Liquidity: `${token.liquidity_usd:,.0f}` | 1h volume: `${token.volume_h1_usd:,.0f}`\n"
            f"1h flow: `{token.buys_h1} buys / {token.sells_h1} sells` | "
            f"5m: `{token.price_change_m5:+.1f}%` | 1h: `{token.price_change_h1:+.1f}%`\n"
            f"{positives}\n"
            f"*Social/web recap:* {social}\n"
            f"*Research warnings:* {warnings}{sources}\n"
            f"Contract: `{token.address}`\n"
            f"Chart: {token.url}\n"
            "✅ Passed automated contract, holder, liquidity, age, and trade-flow gates.\n"
            "⚠️ Research alert only—not a guarantee or automatic trade."
        )
        return await self.send(text)

    async def followup(
        self,
        alert: dict[str, object],
        current_return: float,
        peak_return: float,
        max_drawdown: float,
    ) -> bool:
        outcome = "✅ green" if current_return > 0 else "❌ red"
        return await self.send(
            "⏱️ *FOMO SENTINEL — 24H OUTCOME*\n"
            f"*{alert['symbol']}* · `{alert['chain']}` · score `{alert['score']}/100`\n"
            f"24h result: `{current_return:+.1f}%` {outcome}\n"
            f"Best observed: `{peak_return:+.1f}%` | Worst observed: `{max_drawdown:+.1f}%`\n"
            f"Contract: `{alert['address']}`\n"
            "Recorded automatically for scanner accuracy tracking."
        )
