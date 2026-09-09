from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import aiosqlite

from .models import Evaluation, TokenSnapshot


class Storage:
    def __init__(self, path: str) -> None:
        self.path = path

    async def initialize(self) -> None:
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(self.path) as db:
            await db.executescript(
                """
                CREATE TABLE IF NOT EXISTS evaluations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    observed_at TEXT NOT NULL,
                    chain TEXT NOT NULL,
                    address TEXT NOT NULL,
                    pair_address TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    price_usd REAL NOT NULL,
                    liquidity_usd REAL NOT NULL,
                    market_cap_usd REAL NOT NULL,
                    volume_h1_usd REAL NOT NULL,
                    score INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    reasons_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_eval_token_time
                    ON evaluations(chain, address, observed_at DESC);
                CREATE TABLE IF NOT EXISTS alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sent_at TEXT NOT NULL,
                    chain TEXT NOT NULL,
                    address TEXT NOT NULL,
                    pair_address TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    score INTEGER NOT NULL,
                    price_usd REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_alert_token_time
                    ON alerts(chain, address, sent_at DESC);
                CREATE TABLE IF NOT EXISTS alert_observations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    alert_id INTEGER NOT NULL,
                    observed_at TEXT NOT NULL,
                    price_usd REAL NOT NULL,
                    FOREIGN KEY(alert_id) REFERENCES alerts(id)
                );
                CREATE INDEX IF NOT EXISTS ix_alert_obs
                    ON alert_observations(alert_id, observed_at);
                CREATE TABLE IF NOT EXISTS alert_followups (
                    alert_id INTEGER PRIMARY KEY,
                    reported_at TEXT NOT NULL,
                    current_return_pct REAL NOT NULL,
                    peak_return_pct REAL NOT NULL,
                    max_drawdown_pct REAL NOT NULL,
                    FOREIGN KEY(alert_id) REFERENCES alerts(id)
                );
                """
            )
            await db.commit()

    async def record(self, token: TokenSnapshot, result: Evaluation) -> None:
        async with aiosqlite.connect(self.path) as db:
            await db.execute(
                """INSERT INTO evaluations
                (observed_at, chain, address, pair_address, symbol, price_usd, liquidity_usd,
                 market_cap_usd, volume_h1_usd, score, status, reasons_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    token.discovered_at.isoformat(), token.chain, token.address,
                    token.pair_address, token.symbol, token.price_usd, token.liquidity_usd,
                    token.market_cap_usd, token.volume_h1_usd, result.score, result.status,
                    json.dumps(result.reasons),
                ),
            )
            await db.commit()

    async def confirmation_count(self, token: TokenSnapshot, limit: int) -> int:
        async with aiosqlite.connect(self.path) as db:
            cursor = await db.execute(
                """SELECT status FROM evaluations WHERE chain=? AND address=?
                ORDER BY id DESC LIMIT ?""",
                (token.chain, token.address, limit),
            )
            rows = await cursor.fetchall()
        return sum(1 for row in rows if row[0] == "qualified") if len(rows) == limit else 0

    async def in_cooldown(self, token: TokenSnapshot, hours: int) -> bool:
        cutoff = (datetime.now(UTC) - timedelta(hours=hours)).isoformat()
        async with aiosqlite.connect(self.path) as db:
            cursor = await db.execute(
                "SELECT 1 FROM alerts WHERE chain=? AND address=? AND sent_at>=? LIMIT 1",
                (token.chain, token.address, cutoff),
            )
            return await cursor.fetchone() is not None

    async def record_alert(self, token: TokenSnapshot, result: Evaluation) -> None:
        async with aiosqlite.connect(self.path) as db:
            await db.execute(
                """INSERT INTO alerts
                (sent_at, chain, address, pair_address, symbol, score, price_usd)
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    datetime.now(UTC).isoformat(), token.chain, token.address,
                    token.pair_address, token.symbol, result.score, token.price_usd,
                ),
            )
            await db.commit()

    async def daily_counts(self) -> tuple[int, int, int]:
        cutoff = (datetime.now(UTC) - timedelta(hours=24)).isoformat()
        async with aiosqlite.connect(self.path) as db:
            cursor = await db.execute(
                """SELECT COUNT(*), COUNT(DISTINCT chain || ':' || address),
                SUM(CASE WHEN status='qualified' THEN 1 ELSE 0 END)
                FROM evaluations WHERE observed_at>=?""",
                (cutoff,),
            )
            row = await cursor.fetchone()
        return int(row[0] or 0), int(row[1] or 0), int(row[2] or 0)

    async def recent_evaluations(self, limit: int = 100) -> list[dict[str, object]]:
        async with aiosqlite.connect(self.path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """SELECT observed_at, chain, address, symbol, price_usd, liquidity_usd,
                market_cap_usd, volume_h1_usd, score, status, reasons_json
                FROM evaluations ORDER BY id DESC LIMIT ?""",
                (min(max(limit, 1), 500),),
            )
            rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def active_alerts(self) -> list[dict[str, object]]:
        cutoff = (datetime.now(UTC) - timedelta(hours=30)).isoformat()
        async with aiosqlite.connect(self.path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """SELECT a.* FROM alerts a
                LEFT JOIN alert_followups f ON f.alert_id=a.id
                WHERE f.alert_id IS NULL AND a.sent_at>=? ORDER BY a.sent_at""",
                (cutoff,),
            )
            rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def record_alert_observation(self, alert_id: int, price_usd: float) -> None:
        async with aiosqlite.connect(self.path) as db:
            await db.execute(
                "INSERT INTO alert_observations(alert_id, observed_at, price_usd) VALUES (?, ?, ?)",
                (alert_id, datetime.now(UTC).isoformat(), price_usd),
            )
            await db.commit()

    async def followup_stats(self, alert: dict[str, object]) -> tuple[float, float, float] | None:
        sent_at = datetime.fromisoformat(str(alert["sent_at"]))
        if datetime.now(UTC) - sent_at < timedelta(hours=24):
            return None
        async with aiosqlite.connect(self.path) as db:
            cursor = await db.execute(
                "SELECT price_usd FROM alert_observations WHERE alert_id=? ORDER BY observed_at",
                (int(alert["id"]),),
            )
            prices = [float(row[0]) for row in await cursor.fetchall() if float(row[0]) > 0]
        if not prices:
            return None
        entry = float(alert["price_usd"])
        returns = [(price / entry - 1) * 100 for price in prices]
        return returns[-1], max(returns), min(returns)

    async def record_followup(
        self, alert_id: int, current_return: float, peak_return: float, max_drawdown: float
    ) -> None:
        async with aiosqlite.connect(self.path) as db:
            await db.execute(
                """INSERT OR IGNORE INTO alert_followups
                (alert_id, reported_at, current_return_pct, peak_return_pct, max_drawdown_pct)
                VALUES (?, ?, ?, ?, ?)""",
                (
                    alert_id, datetime.now(UTC).isoformat(), current_return,
                    peak_return, max_drawdown,
                ),
            )
            await db.commit()
