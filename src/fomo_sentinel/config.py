from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    slack_webhook_url: str = ""
    chains: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "solana",
            "ethereum",
            "base",
            "bsc",
            "arbitrum",
            "optimism",
            "polygon",
            "avalanche",
            "linea",
            "zksync",
            "scroll",
            "mantle",
            "sei",
            "sui",
            "aptos",
            "ton",
            "monad",
            "robinhoodchain",
        ]
    )
    geckoterminal_enabled: bool = True
    geckoterminal_networks_per_scan: int = Field(default=2, ge=1, le=3)
    scan_interval_seconds: int = Field(default=5, ge=2, le=3600)
    heartbeat_minutes: int = Field(default=60, ge=5, le=1440)
    daily_summary_hour_utc: int = Field(default=21, ge=0, le=23)
    database_path: str = "/data/fomo-sentinel.db"

    min_liquidity_usd: float = 25_000
    min_hourly_volume_usd: float = 10_000
    min_market_cap_usd: float = 50_000
    max_market_cap_usd: float = 20_000_000
    min_pair_age_minutes: int = 5
    max_pair_age_hours: int = 24
    min_hourly_trades: int = 20
    min_liquidity_to_mcap: float = 0.025
    alert_score: int = Field(default=76, ge=1, le=100)
    required_confirmations: int = Field(default=2, ge=1, le=10)
    alert_cooldown_hours: int = Field(default=8, ge=1, le=168)
    require_security_check: bool = True
    max_top_10_holder_percent: float = Field(default=35, ge=1, le=100)
    rugcheck_base_url: str = "https://api.rugcheck.xyz/v1"
    goplus_base_url: str = "https://api.gopluslabs.io/api/v1"
    robinhood_blockscout_url: str = "https://robinhoodchain.blockscout.com"
    birdeye_api_key: str = ""
    brave_search_api_key: str = ""
    x_bearer_token: str = ""
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    reddit_user_agent: str = "memeeee/0.1"
    social_search_enabled: bool = True
    social_search_result_limit: int = Field(default=10, ge=1, le=20)

    @field_validator("chains", mode="before")
    @classmethod
    def split_chains(cls, value: object) -> object:
        if isinstance(value, str):
            return [part.strip().lower() for part in value.split(",") if part.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
