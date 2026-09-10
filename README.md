# Fomo Sentinel

Fomo Sentinel is an alerts-only, 24/7 meme-coin market scanner designed to run
on its own server. It never accepts wallet keys and cannot place trades.

## What v0.1 does

- Prioritizes Solana and Robinhood Chain while categorizing every alert by chain.
- Watches only pairs created in the last 24 hours for 1–2 day breakout candidates.
- Discovers promoted/recent token profiles through the official DEX Screener API.
- Rotates through GeckoTerminal new-pool feeds for Solana, Robinhood Chain,
  Ethereum, Base, BNB Chain, Arbitrum, Optimism, Polygon, Avalanche, Linea,
  zkSync, Scroll, Mantle, Sei, Sui, Aptos, TON, and Monad.
- Scores momentum, liquidity, volume, trade flow, and liquidity/market-cap.
- Fails closed on safety: missing/inconclusive security data cannot produce an alert.
- Checks Solana through RugCheck; checks EVM chains through GoPlus; corroborates
  Robinhood Chain with its official Blockscout explorer and holder distribution.
- Requires consecutive passing observations and applies an alert cooldown.
- Sends Slack alerts, heartbeats, daily summaries, and error notifications.
- Sends an immediate unverified flash watch, then a separate approved verdict
  after contract/holder and public-web research finishes.
- Enriches qualified candidates with fresh web public X, Reddit, and web results
  when a Brave Search key is configured; social hype can never override a failed
  contract safety check.
- Stores every evaluation and alert in SQLite for later forward-return analysis.
- Tracks each alert continuously and posts a 24-hour outcome with current return,
  best observed return, and worst observed drawdown.
- Exposes `GET /health` and `GET /status` on localhost port 8081 by default.
- Exposes a live, chain-filterable dashboard at `GET /dashboard`.
- Sends an immediate unverified flash watch before slower safety/social enrichment,
  followed by a qualified recap only when the risk gates pass.

## Live analysis flow

1. Discover fresh token/pool activity and categorize it by chain.
2. Apply the under-24-hour, liquidity, volume, market-cap, trade-flow, and
   non-parabolic momentum gates.
3. Send a low-latency **FLASH WATCH** to Slack. This is explicitly not approval.
4. Run contract, authority, honeypot/tax, holder-concentration, and explorer checks.
5. Search the fresh public web for the exact contract and ticker, including indexed
   X and Reddit pages; hype/scam language is flagged rather than rewarded.
6. Send the full qualified recap with why it triggered, evidence, warnings, and links.
7. Track the alert for 24 hours and report current, best, and worst observed returns.

`BIRDEYE_API_KEY`, `BRAVE_SEARCH_API_KEY`, X, and Reddit credentials are optional
configuration slots. Direct high-volume X/Reddit and whole-chain streaming require
the corresponding approved/paid data access. Without those credentials the health
and dashboard remain honest about unavailable enrichment instead of fabricating it.

The free configuration is multi-source polling, not a claim of every transaction
on every blockchain. GeckoTerminal networks are staggered to remain within free
rate limits. The status API and dashboard identify each feed and its actual mode.

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

For a persistent standalone Oracle Cloud systemd deployment, follow
[`deploy/oracle-cloud/README.md`](deploy/oracle-cloud/README.md).

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
