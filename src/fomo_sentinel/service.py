from __future__ import annotations

import asyncio
import logging
from collections import Counter
from datetime import UTC, datetime, timedelta

from .config import Settings
from .dexscreener import DexScreenerClient
from .models import ResearchVerdict
from .research import SocialResearcher
from .scoring import evaluate
from .security import SecurityAnalyzer
from .slack import SlackNotifier
from .storage import Storage

log = logging.getLogger(__name__)


class ScannerService:
    def __init__(self, cfg: Settings) -> None:
        self.cfg = cfg
        self.market_only_cfg = cfg.model_copy(update={"require_security_check": False})
        self.feed = DexScreenerClient(cfg.chains)
        self.storage = Storage(cfg.database_path)
        self.slack = SlackNotifier(cfg.slack_webhook_url)
        self.security = SecurityAnalyzer(cfg)
        self.research = SocialResearcher(cfg)
        self.running = False
        self.last_scan_at: str | None = None
        self.last_error: str | None = None
        self.scans = 0
        self.candidates_seen = 0
        self.alerts_sent = 0
        self.chain_observations: Counter[str] = Counter()
        self.unavailable: set[str] = set()
        self._last_heartbeat = datetime.now(UTC)
        self._last_summary_date: str | None = None
        self._flash_sent: dict[str, datetime] = {}

    async def start(self) -> None:
        await self.storage.initialize()
        self.running = True
        await self.slack.send(
            "🟢 *Fomo Sentinel is live* — alerts-only mode, scanning 24/7 across: "
            + ", ".join(self.cfg.chains)
        )

    async def stop(self) -> None:
        self.running = False
        await self.feed.close()
        await self.security.close()
        await self.research.close()
        await self.slack.close()

    async def run_forever(self) -> None:
        await self.start()
        while self.running:
            started = datetime.now(UTC)
            try:
                await self.scan_once()
                self.last_error = None
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # keep the daemon alive; report the failure
                self.last_error = f"{type(exc).__name__}: {exc}"
                log.exception("scan failed")
                await self.slack.send(f"🔴 *Fomo Sentinel scan error*\n`{self.last_error[:500]}`")
            await self._scheduled_messages()
            elapsed = (datetime.now(UTC) - started).total_seconds()
            await asyncio.sleep(max(1, self.cfg.scan_interval_seconds - elapsed))

    async def scan_once(self) -> None:
        tokens, failures = await self.feed.discover()
        self.unavailable = failures
        self.scans += 1
        self.candidates_seen += len(tokens)
        self.last_scan_at = datetime.now(UTC).isoformat()
        for token in tokens:
            self.chain_observations[token.chain] += 1
            preliminary = evaluate(token, self.market_only_cfg)
            security = None
            research = ResearchVerdict(False, "not run")
            if preliminary.status == "qualified":
                flash_key = f"{token.chain}:{token.address}"
                last_flash = self._flash_sent.get(flash_key)
                if last_flash is None or datetime.now(UTC) - last_flash >= timedelta(
                    hours=self.cfg.alert_cooldown_hours
                ) and await self.slack.flash_alert(token, preliminary):
                    self._flash_sent[flash_key] = datetime.now(UTC)
                security_result, research_result = await asyncio.gather(
                    self.security.analyze(token), self.research.research(token), return_exceptions=True
                )
                if not isinstance(security_result, Exception):
                    security = security_result
                if not isinstance(research_result, Exception):
                    research = research_result
                result = evaluate(token, self.cfg, security)
            else:
                result = preliminary
            await self.storage.record(token, result)
            if result.status != "qualified":
                continue
            confirmations = await self.storage.confirmation_count(token, self.cfg.required_confirmations)
            if confirmations < self.cfg.required_confirmations:
                continue
            if await self.storage.in_cooldown(token, self.cfg.alert_cooldown_hours):
                continue
            if await self.slack.alert(token, result, research):
                await self.storage.record_alert(token, result)
                self.alerts_sent += 1
        await self._track_alerts()

    async def _track_alerts(self) -> None:
        for alert in await self.storage.active_alerts():
            try:
                token = await self.feed.fetch_token(
                    str(alert["chain"]), str(alert["address"]), str(alert["pair_address"])
                )
                if token and token.price_usd > 0:
                    await self.storage.record_alert_observation(int(alert["id"]), token.price_usd)
                stats = await self.storage.followup_stats(alert)
                if stats is None:
                    continue
                current_return, peak_return, max_drawdown = stats
                if await self.slack.followup(alert, current_return, peak_return, max_drawdown):
                    await self.storage.record_followup(
                        int(alert["id"]), current_return, peak_return, max_drawdown
                    )
            except Exception as exc:  # noqa: BLE001 - isolate one tracked token from daemon loop
                log.warning("alert tracking failed for %s: %s", alert.get("address"), exc)

    async def _scheduled_messages(self) -> None:
        now = datetime.now(UTC)
        if (now - self._last_heartbeat).total_seconds() >= self.cfg.heartbeat_minutes * 60:
            await self.slack.send(
                f"🫀 *Fomo Sentinel heartbeat* — scans: `{self.scans}`, "
                f"candidates: `{self.candidates_seen}`, alerts: `{self.alerts_sent}`, "
                f"last scan: `{self.last_scan_at}`"
            )
            self._last_heartbeat = now
        today = now.date().isoformat()
        if now.hour == self.cfg.daily_summary_hour_utc and self._last_summary_date != today:
            evaluations, unique_tokens, qualifying = await self.storage.daily_counts()
            chain_text = ", ".join(f"{k}: {v}" for k, v in sorted(self.chain_observations.items())) or "none"
            await self.slack.send(
                "📊 *Fomo Sentinel — 24h summary*\n"
                f"Evaluations: `{evaluations}` | Unique tokens: `{unique_tokens}` | "
                f"Qualifying observations: `{qualifying}` | Alerts sent: `{self.alerts_sent}`\n"
                f"Chain observations: {chain_text}\n"
                f"Unavailable feeds: `{', '.join(sorted(self.unavailable)) or 'none'}`"
            )
            self._last_summary_date = today

    def status(self) -> dict[str, object]:
        observed = set(self.chain_observations)
        return {
            "ok": self.running and self.last_error is None,
            "mode": "alerts-only",
            "running": self.running,
            "last_scan_at": self.last_scan_at,
            "last_error": self.last_error,
            "scans": self.scans,
            "candidates_seen": self.candidates_seen,
            "alerts_sent": self.alerts_sent,
            "configured_chains": self.cfg.chains,
            "observed_chains": sorted(observed),
            "not_yet_observed": sorted(set(self.cfg.chains) - observed),
            "feed_failures": sorted(self.unavailable),
        }
