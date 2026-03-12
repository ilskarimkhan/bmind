# ============================================
# BMIND USERBOT — Tests: Significance Filter
# ============================================

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from filters import is_significant


KEYWORDS = [
    "tomorrow", "deadline", "meeting", "exam", "sat",
    "due", "call", "submit", "project", "assignment",
    "urgent", "asap", "important", "reminder",
]


def test_keyword_match():
    """Messages with trigger keywords should be significant."""
    sig, matched = is_significant("Submit the report by tomorrow", KEYWORDS)
    assert sig is True
    assert "submit" in matched
    assert "tomorrow" in matched


def test_keyword_case_insensitive():
    """Keyword matching should be case-insensitive."""
    sig, matched = is_significant("DEADLINE IS FRIDAY", KEYWORDS)
    assert sig is True
    assert "deadline" in matched


def test_date_pattern():
    """Messages with date-like patterns should be significant."""
    sig, matched = is_significant("Send it by 03/15", KEYWORDS)
    assert sig is True
    assert "date_detected" in matched


def test_relative_date():
    """Relative dates like 'next Monday' should trigger."""
    sig, matched = is_significant("Let's do this next Monday", KEYWORDS)
    assert sig is True
    assert "date_detected" in matched


def test_noise_filtered():
    """Short noise like 'lol' should NOT be significant."""
    sig, matched = is_significant("lol", KEYWORDS)
    assert sig is False
    assert matched == []


def test_ok_noise():
    """'ok' should be filtered as noise."""
    sig, matched = is_significant("ok", KEYWORDS)
    assert sig is False


def test_empty_message():
    """Empty messages should not be significant."""
    sig, matched = is_significant("", KEYWORDS)
    assert sig is False


def test_none_message():
    """None text should not be significant."""
    sig, matched = is_significant(None, KEYWORDS)
    assert sig is False


def test_regular_message_no_keywords():
    """Normal conversation without keywords should NOT be significant."""
    sig, matched = is_significant("Hey how are you doing? Nice weather today!", KEYWORDS)
    assert sig is False


def test_blacklisted_chat():
    """Messages from blacklisted chats should never be significant."""
    sig, matched = is_significant(
        "Submit the report by tomorrow",
        KEYWORDS,
        blacklisted_chat_id=12345,
        blacklisted_chats=[12345, 67890],
    )
    assert sig is False
    assert matched == []


def test_not_blacklisted_chat():
    """Messages from non-blacklisted chats should pass through."""
    sig, matched = is_significant(
        "Submit the report by tomorrow",
        KEYWORDS,
        blacklisted_chat_id=99999,
        blacklisted_chats=[12345, 67890],
    )
    assert sig is True


def test_exam_keyword():
    """'exam' keyword should trigger significance."""
    sig, matched = is_significant("Bio exam next week", KEYWORDS)
    assert sig is True
    assert "exam" in matched


def test_date_format_dd_mm():
    """European date format DD.MM should be detected."""
    sig, matched = is_significant("The party is on 15.03", KEYWORDS)
    assert sig is True
    assert "date_detected" in matched


def test_in_n_days():
    """'in 3 days' pattern should be detected."""
    sig, matched = is_significant("The event is in 3 days", KEYWORDS)
    assert sig is True
    assert "date_detected" in matched


if __name__ == "__main__":
    tests = [v for k, v in globals().items() if k.startswith("test_")]
    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            print(f"  ✅ {test.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"  ❌ {test.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"  💥 {test.__name__}: {e}")
            failed += 1
    print(f"\n  Results: {passed} passed, {failed} failed out of {passed + failed}")
