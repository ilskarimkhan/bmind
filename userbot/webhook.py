# ============================================
# BMIND USERBOT — Webhook Producer
# Async HTTP client with rate limiting & batching
# ============================================

import asyncio
import time
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("bmind.webhook")


@dataclass
class WebhookPayload:
    """A single message payload ready to POST."""
    user_id: str = ""
    source: str = "telegram"
    chat_id: int = 0
    chat_name: str = ""
    sender_name: str = ""
    message_text: str = ""
    timestamp: str = ""
    is_group: bool = False
    has_media: bool = False
    context_history: List[str] = field(default_factory=list)
    matched_keywords: List[str] = field(default_factory=list)
    event_type: str = "new_message"  # or "edited_message"
    message_id: int = 0              # Telegram message ID for edit tracking

    def to_dict(self) -> Dict[str, Any]:
        # Include context in text if available
        final_text = self.message_text
        if self.context_history:
            # We don't include the exact current message twice, context is previous messages
            ctx_str = "\\n".join(self.context_history)
            final_text = f"[Context:\\n{ctx_str}]\\n\\nCurrent Message:\\n{final_text}"

        d: Dict[str, Any] = {
            "userId": self.user_id,
            "source": self.source,
            "text": final_text,
            "senderName": self.sender_name,
            "conversation": self.chat_name,
            "sourceTimestamp": self.timestamp,
            "chatId": str(self.chat_id)
        }
        if self.event_type == "edited_message":
            d["message_id"] = self.message_id
        return d


class WebhookProducer:
    """
    Async webhook producer with rate limiting and optional batching.

    - Token-bucket rate limiter: enforces min_interval_seconds between sends
    - Batch accumulation: collects payloads for batch_window_seconds, then fires
    - Immediate send for urgent items
    """

    def __init__(
        self,
        webhook_url: str,
        min_interval: float = 2.0,
        batch_window: float = 10.0,
        max_batch_size: int = 5,
    ):
        self.webhook_url = webhook_url
        self.min_interval = min_interval
        self.batch_window = batch_window
        self.max_batch_size = max_batch_size

        self._client: Optional[httpx.AsyncClient] = None
        self._batch: List[Dict[str, Any]] = []
        self._last_send_time: float = 0.0
        self._flush_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        """Initialize the HTTP client."""
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            headers={"Content-Type": "application/json"},
        )
        logger.info(f"Webhook producer started → {self.webhook_url}")

    async def stop(self) -> None:
        """Flush remaining batch and close the client."""
        if self._flush_task and not self._flush_task.done():
            self._flush_task.cancel()

        # Flush any remaining payloads
        await self._flush_now()

        if self._client:
            await self._client.aclose()
            self._client = None
        logger.info("Webhook producer stopped.")

    async def send(self, payload: WebhookPayload, urgent: bool = False) -> None:
        """
        Queue a payload for sending.

        Args:
            payload: The message payload to send.
            urgent: If True, skip batching and send immediately.
        """
        data = payload.to_dict()

        if urgent:
            await self._send_single(data)
            return

        async with self._lock:
            self._batch.append(data)

            # Force flush if batch is full
            if len(self._batch) >= self.max_batch_size:
                await self._flush_now()
                return

            # Schedule a delayed flush if not already pending
            if self._flush_task is None or self._flush_task.done():
                self._flush_task = asyncio.create_task(
                    self._delayed_flush()
                )

    async def _delayed_flush(self) -> None:
        """Wait for the batch window, then flush."""
        await asyncio.sleep(self.batch_window)
        await self._flush_now()

    async def _flush_now(self) -> None:
        """Flush all accumulated payloads."""
        async with self._lock:
            if not self._batch:
                return

            payloads = self._batch.copy()
            self._batch.clear()

        # Send each payload individually with rate limiting
        for data in payloads:
            await self._send_single(data)

    async def _send_single(self, data: Dict[str, Any]) -> None:
        """Send a single payload with rate limiting."""
        if not self._client:
            logger.warning("Webhook client not initialized. Skipping send.")
            return

        # Rate limiting — wait if needed
        now = time.monotonic()
        elapsed = now - self._last_send_time
        if elapsed < self.min_interval:
            await asyncio.sleep(self.min_interval - elapsed)

        try:
            response = await self._client.post(self.webhook_url, json=data)
            self._last_send_time = time.monotonic()

            if response.status_code >= 400:
                logger.error(
                    f"Webhook POST failed [{response.status_code}]: "
                    f"{response.text[:200]}"
                )
            else:
                logger.info(
                    f"✅ Webhook POST → {data.get('conversation', '?')} "
                    f"[{response.status_code}]"
                )

        except httpx.HTTPError as e:
            logger.error(f"Webhook HTTP error: {e}")
        except Exception as e:
            logger.error(f"Webhook unexpected error: {e}")

    @property
    def pending_count(self) -> int:
        """Number of payloads waiting in the batch buffer."""
        return len(self._batch)
