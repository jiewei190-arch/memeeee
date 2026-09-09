# Fomo Sentinel

Fomo Sentinel is an alerts-only, 24/7 meme-coin market scanner designed to run
beside Botty. It never accepts wallet keys and cannot place trades.

## What v0.1 does

- Prioritizes Solana and Robinhood Chain while categorizing every alert by chain.
- Watches only pairs created in the last 24 hours for 1–2 day breakout candidates.
- Discovers promoted/recent token profiles through the official DEX Screener API.
- Scores momentum, liquidity, volume, trade flow, and liquidity/market-cap.
- Fails closed on safety: missing/inconclusive security data cannot produce an alert.
- Checks Solana through RugCheck; checks EVM chains through GoPlus; corroborates
  Robinhood Chain with its official Blockscout explorer and holder distribution.
- Requires consecutive passing observations and applies an alert cooldown.
- Sends Slack alerts, heartbeats, daily summaries, and error notifications.
- Stores every evaluation and alert in SQLite for later forward-return analysis.
- Tracks each alert continuously and posts a 24-hour outcome with current return,
  best observed return, and worst observed drawdown.
- Exposes `GET /health` and `GET /status` on localhost port 8081 by default.

This version deliberately does **not** trade, request a wallet seed/private key,
or claim an alert will be profitable. An alert is a research lead, not a buy order.

## Quick start on Oracle Linux/Ubuntu

```bash
cp .env.example .env
# Edit .env locally on the server; never send secrets in chat.
docker compose up -d --build
docker compose logs -f --tail=100
curl http://127.0.0.1:8081/health
```

## Before using real-money decisions

The free discovery feed is enough to validate uptime and scoring, but not enough
to call a token safe. Production alerts should add a paid real-time feed and
chain-specific contract/holder checks. Keep the scanner in observation mode for
at least two weeks, then judge it on forward returns, drawdown, alert count, and
false-positive rate rather than a few screenshots.

## Alert meaning

- **Rejected:** failed a hard quality gate; logged but never sent to Slack.
- **Watching:** passed the gates once; must pass again on a later scan.
- **Qualified:** passed enough consecutive scans and cleared `ALERT_SCORE`.
- **Cooldown:** previously alerted and will not alert again until cooldown ends.

All thresholds live in `.env` so later tuning does not require code edits.
