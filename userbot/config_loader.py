# ============================================
# BMIND USERBOT — Config Loader
# Loads config.yaml + .env and exposes typed settings
# ============================================

import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

import yaml
from dotenv import load_dotenv

# Base directory = the userbot/ folder
BASE_DIR = Path(__file__).resolve().parent

# Load .env from the userbot directory
load_dotenv(BASE_DIR / ".env")


@dataclass
class RateLimitConfig:
    min_interval_seconds: float = 2.0
    batch_window_seconds: float = 10.0
    max_batch_size: int = 5


@dataclass
class Config:
    # Telegram MTProto credentials
    api_id: int = 0
    api_hash: str = ""

    # Bmind webhook configuration
    bmind_webhook_url: str = "http://localhost:3001/api/ingest"
    bmind_user_id: str = ""

    # Significance filter
    trigger_keywords: List[str] = field(default_factory=list)

    # Privacy
    blacklisted_chats: List[int] = field(default_factory=list)

    # Rate limiting
    rate_limit: RateLimitConfig = field(default_factory=RateLimitConfig)

    # Context window depth
    context_depth: int = 2

    # Session storage
    session_dir: str = "sessions"

    @property
    def session_path(self) -> Path:
        """Absolute path to the sessions directory."""
        return BASE_DIR / self.session_dir


def load_config() -> Config:
    """
    Load configuration from config.yaml, then overlay environment variables.
    Environment variables take precedence over YAML values.
    """
    config_path = BASE_DIR / "config.yaml"

    # ---- Load YAML ----
    yaml_data = {}
    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            yaml_data = yaml.safe_load(f) or {}

    # ---- Build Config ----
    rate_limit_raw = yaml_data.get("rate_limit", {})
    rate_limit = RateLimitConfig(
        min_interval_seconds=float(rate_limit_raw.get("min_interval_seconds", 2)),
        batch_window_seconds=float(rate_limit_raw.get("batch_window_seconds", 10)),
        max_batch_size=int(rate_limit_raw.get("max_batch_size", 5)),
    )

    cfg = Config(
        api_id=int(os.getenv("TELEGRAM_API_ID", "0")),
        api_hash=os.getenv("TELEGRAM_API_HASH", ""),
        bmind_user_id=os.getenv(
            "BMIND_USER_ID",
            str(yaml_data.get("bmind_user_id", "")),
        ),
        bmind_webhook_url=os.getenv(
            "BMIND_WEBHOOK_URL",
            str(yaml_data.get("bmind_webhook_url", "http://localhost:3001/api/ingest")),
        ),
        trigger_keywords=[
            kw.lower() for kw in yaml_data.get("trigger_keywords", [])
        ],
        blacklisted_chats=[
            int(cid) for cid in yaml_data.get("blacklisted_chats", []) if cid
        ],
        rate_limit=rate_limit,
        context_depth=int(yaml_data.get("context_depth", 2)),
        session_dir=yaml_data.get("session_dir", "sessions"),
    )

    # ---- Validate ----
    if not cfg.api_id or not cfg.api_hash:
        print(
            "\n❌  Missing TELEGRAM_API_ID or TELEGRAM_API_HASH.\n"
            "    1. Go to https://my.telegram.org → 'API development tools'\n"
            "    2. Copy your API ID and Hash\n"
            "    3. Paste them in userbot/.env\n"
        )
        sys.exit(1)

    if not cfg.bmind_user_id:
        print(
            "\n❌  Missing BMIND_USER_ID.\n"
            "    Since the UserBot sends data directly to your Bmind dashboard,\n"
            "    you must configure your user ID in userbot/.env\n"
        )
        sys.exit(1)

    if not cfg.trigger_keywords:
        # Fallback defaults
        cfg.trigger_keywords = [
            "tomorrow", "deadline", "meeting", "exam", "sat",
            "due", "call", "submit", "project", "assignment",
        ]

    # Ensure session directory exists
    cfg.session_path.mkdir(parents=True, exist_ok=True)

    return cfg
