# ============================================
# BMIND USERBOT — Main Entry Point
# Telegram UserBot listener using Pyrogram
# ============================================

import asyncio
import logging
import signal
import sys
from pathlib import Path

from pyrogram import Client
from pyrogram.errors import FloodWait

from config_loader import load_config
from context_window import ContextWindow
from handlers import register_handlers
from webhook import WebhookProducer

# ---- Logging setup ----
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("bmind.userbot")

# Suppress noisy pyrogram internals
logging.getLogger("pyrogram").setLevel(logging.WARNING)


BANNER = r"""
   ____            _           _
  | __ ) _ __ ___ (_)_ __   __| |
  |  _ \| '_ ` _ \| | '_ \ / _` |
  | |_) | | | | | | | | | | (_| |
  |____/|_| |_| |_|_|_| |_|\__,_|

  Telegram UserBot Listener v1.0
  ─────────────────────────────────
"""


async def main() -> None:
    """Main async entry point."""
    print(BANNER)

    # ---- Load configuration ----
    config = load_config()
    logger.info(f"Config loaded: {len(config.trigger_keywords)} keywords, "
                f"{len(config.blacklisted_chats)} blacklisted chats")
    logger.info(f"Webhook URL: {config.bmind_webhook_url}")

    # ---- Initialize context window ----
    context_window = ContextWindow(depth=config.context_depth)
    logger.info(f"Context window: depth={config.context_depth}")

    # ---- Initialize webhook producer ----
    webhook = WebhookProducer(
        webhook_url=config.bmind_webhook_url,
        min_interval=config.rate_limit.min_interval_seconds,
        batch_window=config.rate_limit.batch_window_seconds,
        max_batch_size=config.rate_limit.max_batch_size,
    )
    await webhook.start()

    # ---- Create Pyrogram client ----
    session_name = str(config.session_path / "bmind_userbot")
    app = Client(
        name=session_name,
        api_id=config.api_id,
        api_hash=config.api_hash,
    )

    # ---- Register handlers ----
    register_handlers(app, config, context_window, webhook)

    # ---- Graceful shutdown ----
    stop_event = asyncio.Event()

    def _signal_handler():
        logger.info("Shutdown signal received...")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _signal_handler)
        except NotImplementedError:
            # Windows doesn't support add_signal_handler for SIGTERM
            pass

    # ---- Start the client ----
    logger.info("Starting Pyrogram client...")
    logger.info("On first run, you will be prompted for your phone number and OTP code.")
    logger.info("─" * 50)

    try:
        await app.start()
    except FloodWait as e:
        logger.error(f"❌ Telegram rate limit (FloodWait) hit! You must wait {e.value} seconds before attempting to log in again.")
        return

    me = await app.get_me()
    logger.info(f"✅  Logged in as: {me.first_name} {me.last_name or ''} (@{me.username or 'no-username'})")
    logger.info(f"📡  Listening for messages across all chats...")
    logger.info(f"📤  Significant messages will be forwarded to: {config.bmind_webhook_url}")
    logger.info(f"🛑  Press Ctrl+C to stop.\n")

    # ---- Keep running until shutdown ----
    try:
        await stop_event.wait()
    except KeyboardInterrupt:
        pass

    # ---- Clean shutdown ----
    logger.info("Shutting down...")
    await webhook.stop()
    await app.stop()
    logger.info("Goodbye! 👋")


def run() -> None:
    """Synchronous wrapper to launch the async main function."""
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    run()
