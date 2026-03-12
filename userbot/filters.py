# ============================================
# BMIND USERBOT — Significance Filter
# Pre-processes messages to avoid flooding Groq
# ============================================

import re
from typing import List, Optional, Tuple


# Date-like patterns: "03/15", "15.03", "March 15", "3/15/2026", etc.
DATE_PATTERNS = [
    r"\b\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{2,4})?\b",          # 03/15, 15.03.2026
    r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}\b",  # March 15
    r"\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\b",  # 15 March
    r"\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",       # Day names
    r"\bnext\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
    r"\bthis\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
    r"\bin\s+\d+\s+(?:day|hour|minute|week|month)s?\b",       # in 3 days
    r"\b(?:tonight|today|yesterday)\b",
]

# Compiled regex for performance
_date_regex = re.compile(
    "|".join(DATE_PATTERNS),
    re.IGNORECASE,
)

# Noise patterns — messages that are almost never significant
NOISE_PATTERNS = re.compile(
    r"^(?:lol|ok|okay|haha|😂|👍|🔥|bruh|lmao|yep|yeah|nah|sure|cool|nice|wow|omg|ty|thx|np|gn|gm|idk)$",
    re.IGNORECASE,
)


def is_significant(
    text: str,
    trigger_keywords: List[str],
    blacklisted_chat_id: Optional[int] = None,
    blacklisted_chats: Optional[List[int]] = None,
) -> Tuple[bool, List[str]]:
    """
    Determine whether a message is significant enough to forward to the LLM.

    Returns:
        (is_significant, matched_keywords)
    """
    # ---- Blacklist check ----
    if blacklisted_chats and blacklisted_chat_id in blacklisted_chats:
        return False, []

    if not text or not text.strip():
        return False, []

    clean = text.strip()

    # ---- Noise filter ----
    if len(clean) < 5 and NOISE_PATTERNS.match(clean):
        return False, []

    # ---- Keyword matching (case-insensitive) ----
    lower_text = clean.lower()
    matched = [kw for kw in trigger_keywords if kw in lower_text]

    # ---- Date pattern matching ----
    date_matches = _date_regex.findall(lower_text)
    if date_matches:
        matched.append("date_detected")

    if matched:
        return True, matched

    return False, []


def check_media(message) -> bool:
    """
    Check if a Pyrogram message contains media (photo, document, video, etc.).

    Args:
        message: pyrogram.types.Message object

    Returns:
        True if the message has media content
    """
    media_attrs = [
        "photo", "video", "document", "animation",
        "audio", "voice", "video_note", "sticker",
    ]
    return any(getattr(message, attr, None) for attr in media_attrs)


def get_text_from_message(message) -> str:
    """
    Extract text from a Pyrogram message, including captions for media.

    Args:
        message: pyrogram.types.Message object

    Returns:
        The message text or caption, or empty string
    """
    if message.text:
        return message.text
    if message.caption:
        return message.caption
    return ""
