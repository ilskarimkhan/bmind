# ============================================
# BMIND USERBOT — Context Window
# Per-chat rolling buffer of recent messages
# ============================================

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional


@dataclass
class ContextEntry:
    """A single message stored in the context buffer."""
    text: str
    sender_name: str
    timestamp: str  # ISO 8601
    message_id: int = 0


class ContextWindow:
    """
    Maintains a per-chat rolling buffer of the last N messages.
    When a significant message is detected, the caller can retrieve
    the previous messages as context for the LLM.
    """

    def __init__(self, depth: int = 2):
        """
        Args:
            depth: How many *previous* messages to keep (not counting current).
                   Total buffer size per chat = depth + 1.
        """
        self.depth = depth
        # chat_id → deque of ContextEntry
        self._buffers: Dict[int, deque] = {}

    def add(
        self,
        chat_id: int,
        text: str,
        sender_name: str,
        timestamp: str,
        message_id: int = 0,
    ) -> None:
        """Add a message to the rolling buffer for a chat."""
        if chat_id not in self._buffers:
            # +1 so we store depth previous messages PLUS the current one
            self._buffers[chat_id] = deque(maxlen=self.depth + 1)

        self._buffers[chat_id].append(
            ContextEntry(
                text=text,
                sender_name=sender_name,
                timestamp=timestamp,
                message_id=message_id,
            )
        )

    def get_context(self, chat_id: int) -> List[str]:
        """
        Get the previous N messages (as plain text strings) for a chat,
        excluding the most recent message (which is the trigger).

        Returns:
            List of message strings like ["sender: text", ...], oldest first.
            Empty list if no context is available.
        """
        buf = self._buffers.get(chat_id)
        if not buf or len(buf) <= 1:
            return []

        # Everything except the last entry (which is the current/trigger message)
        context_entries = list(buf)[:-1]
        return [
            f"{entry.sender_name}: {entry.text}" for entry in context_entries
        ]

    def get_context_entries(self, chat_id: int) -> List[ContextEntry]:
        """
        Get previous context entries as ContextEntry objects (for richer data).
        """
        buf = self._buffers.get(chat_id)
        if not buf or len(buf) <= 1:
            return []
        return list(buf)[:-1]

    def clear_chat(self, chat_id: int) -> None:
        """Remove all buffered messages for a specific chat."""
        self._buffers.pop(chat_id, None)

    @property
    def active_chats(self) -> int:
        """Number of chats currently tracked."""
        return len(self._buffers)
