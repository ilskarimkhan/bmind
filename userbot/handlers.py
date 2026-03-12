# ============================================
# BMIND USERBOT — Message Handlers
# Pyrogram event handlers for new & edited messages
# ============================================

import logging
from datetime import datetime, timezone

from pyrogram import Client, filters
from pyrogram.enums import ChatType
from pyrogram.types import Message

from config_loader import Config
from context_window import ContextWindow
from filters import is_significant, check_media, get_text_from_message
from webhook import WebhookPayload, WebhookProducer

logger = logging.getLogger("bmind.handlers")

# Chat types that map to is_group=True
_GROUP_TYPES = {ChatType.GROUP, ChatType.SUPERGROUP, ChatType.CHANNEL}


def _get_sender_name(message: Message) -> str:
    """Extract sender display name from a Pyrogram message."""
    if message.from_user:
        parts = [message.from_user.first_name, message.from_user.last_name]
        return " ".join(p for p in parts if p)
    if message.sender_chat:
        return message.sender_chat.title or "Channel"
    return "Unknown"


def _get_chat_name(message: Message) -> str:
    """Extract chat title or DM name."""
    if message.chat.title:
        return message.chat.title
    # For private chats, use the other user's name
    if message.chat.first_name:
        parts = [message.chat.first_name, message.chat.last_name]
        return " ".join(p for p in parts if p)
    return f"Chat {message.chat.id}"


def _build_payload(
    message: Message,
    text: str,
    matched_keywords: list,
    context_history: list,
    has_media: bool,
    config: Config,
    event_type: str = "new_message",
) -> WebhookPayload:
    """Build a WebhookPayload from a Pyrogram message."""
    # Use message date, fallback to now
    ts = message.date or datetime.now(timezone.utc)
    if isinstance(ts, datetime):
        timestamp = ts.isoformat()
    else:
        timestamp = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()

    return WebhookPayload(
        user_id=config.bmind_user_id,
        source="telegram",
        chat_id=message.chat.id,
        chat_name=_get_chat_name(message),
        sender_name=_get_sender_name(message),
        message_text=text,
        timestamp=timestamp,
        is_group=message.chat.type in _GROUP_TYPES,
        has_media=has_media,
        context_history=context_history,
        matched_keywords=matched_keywords,
        event_type=event_type,
        message_id=message.id,
    )


def register_handlers(
    app: Client,
    config: Config,
    context_window: ContextWindow,
    webhook: WebhookProducer,
) -> None:
    """
    Register all Pyrogram message handlers on the client.

    Args:
        app: The Pyrogram Client instance.
        config: Loaded Config object.
        context_window: Shared ContextWindow for all chats.
        webhook: The WebhookProducer for sending payloads.
    """

    # ================================================================
    #  HANDLER 1 — New Messages (Private, Group, Supergroup, Channel)
    # ================================================================
    @app.on_message(
        filters.text | filters.caption | filters.photo | filters.document | filters.video
    )
    async def on_new_message(_client: Client, message: Message) -> None:
        try:
            chat_id = message.chat.id
            text = get_text_from_message(message)
            sender = _get_sender_name(message)
            has_media = check_media(message)

            # Build timestamp
            ts = message.date or datetime.now(timezone.utc)
            ts_str = ts.isoformat() if isinstance(ts, datetime) else datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()

            # Always add to context window (even noise, so context is accurate)
            context_window.add(
                chat_id=chat_id,
                text=text or "[media]",
                sender_name=sender,
                timestamp=ts_str,
                message_id=message.id,
            )

            # If no text at all (pure media without caption), flag it but check significance
            if not text:
                if has_media:
                    # Pure media — skip unless we want to flag all media
                    logger.debug(f"[{_get_chat_name(message)}] Pure media, skipping.")
                return

            # ---- Significance filter ----
            significant, matched = is_significant(
                text=text,
                trigger_keywords=config.trigger_keywords,
                blacklisted_chat_id=chat_id,
                blacklisted_chats=config.blacklisted_chats,
            )

            if not significant:
                logger.debug(f"[{_get_chat_name(message)}] Noise: {text[:40]}...")
                return

            # ---- Build payload with context ----
            context_history = context_window.get_context(chat_id)
            payload = _build_payload(
                message=message,
                text=text,
                matched_keywords=matched,
                context_history=context_history,
                has_media=has_media,
                config=config,
                event_type="new_message",
            )

            logger.info(
                f"🔔 Significant message in [{payload.chat_name}] "
                f"from {payload.sender_name}: {text[:50]}... "
                f"Keywords: {matched}"
            )

            # Check if urgent (contains "urgent", "asap", or deadline-like word)
            urgent = any(kw in ("urgent", "asap") for kw in matched)
            await webhook.send(payload, urgent=urgent)

        except Exception as e:
            logger.error(f"Handler error (new_message): {e}", exc_info=True)

    # ================================================================
    #  HANDLER 2 — Edited Messages
    # ================================================================
    @app.on_edited_message(
        filters.text | filters.caption
    )
    async def on_edited_message(_client: Client, message: Message) -> None:
        try:
            chat_id = message.chat.id
            text = get_text_from_message(message)
            has_media = check_media(message)

            if not text:
                return

            # ---- Significance filter on the NEW text ----
            significant, matched = is_significant(
                text=text,
                trigger_keywords=config.trigger_keywords,
                blacklisted_chat_id=chat_id,
                blacklisted_chats=config.blacklisted_chats,
            )

            if not significant:
                return

            # ---- Build edit payload ----
            context_history = context_window.get_context(chat_id)
            payload = _build_payload(
                message=message,
                text=text,
                matched_keywords=matched,
                context_history=context_history,
                has_media=has_media,
                config=config,
                event_type="edited_message",
            )

            logger.info(
                f"✏️  Edited message in [{payload.chat_name}] "
                f"msg_id={message.id}: {text[:50]}..."
            )

            # Edits that change deadlines are always urgent
            await webhook.send(payload, urgent=True)

        except Exception as e:
            logger.error(f"Handler error (edited_message): {e}", exc_info=True)

    logger.info("All Pyrogram handlers registered.")
