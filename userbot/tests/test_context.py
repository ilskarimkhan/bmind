# ============================================
# BMIND USERBOT — Tests: Context Window
# ============================================

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from context_window import ContextWindow


def test_empty_context():
    """No messages yet → empty context."""
    cw = ContextWindow(depth=2)
    assert cw.get_context(12345) == []


def test_single_message_no_context():
    """One message added → no context (it's the 'current' message)."""
    cw = ContextWindow(depth=2)
    cw.add(12345, "Hello", "Alice", "2026-01-01T00:00:00")
    assert cw.get_context(12345) == []


def test_two_messages_one_context():
    """Two messages → first one is context for the second."""
    cw = ContextWindow(depth=2)
    cw.add(12345, "Hello", "Alice", "2026-01-01T00:00:00")
    cw.add(12345, "Meeting tomorrow", "Bob", "2026-01-01T00:01:00")
    ctx = cw.get_context(12345)
    assert len(ctx) == 1
    assert "Alice: Hello" in ctx[0]


def test_three_messages_full_context():
    """Three messages → two context entries for the third."""
    cw = ContextWindow(depth=2)
    cw.add(12345, "Hey all", "Alice", "2026-01-01T00:00:00")
    cw.add(12345, "What's up?", "Bob", "2026-01-01T00:01:00")
    cw.add(12345, "Deadline is Friday", "Alice", "2026-01-01T00:02:00")
    ctx = cw.get_context(12345)
    assert len(ctx) == 2
    assert "Alice: Hey all" in ctx[0]
    assert "Bob: What's up?" in ctx[1]


def test_rolling_window():
    """Adding more than depth+1 messages should evict oldest."""
    cw = ContextWindow(depth=2)
    cw.add(1, "msg1", "A", "t1")
    cw.add(1, "msg2", "B", "t2")
    cw.add(1, "msg3", "C", "t3")
    cw.add(1, "msg4", "D", "t4")  # msg1 should be evicted
    ctx = cw.get_context(1)
    assert len(ctx) == 2
    # Context should be msg2 and msg3, current is msg4
    assert "B: msg2" in ctx[0]
    assert "C: msg3" in ctx[1]


def test_separate_chats():
    """Different chats should have independent context buffers."""
    cw = ContextWindow(depth=2)
    cw.add(100, "Hello from chat 100", "Alice", "t1")
    cw.add(200, "Hello from chat 200", "Bob", "t2")
    cw.add(100, "Meeting tomorrow", "Alice", "t3")

    ctx_100 = cw.get_context(100)
    ctx_200 = cw.get_context(200)

    assert len(ctx_100) == 1
    assert "Alice: Hello from chat 100" in ctx_100[0]
    assert ctx_200 == []  # Only one message, no context


def test_clear_chat():
    """Clearing a chat should remove its buffer."""
    cw = ContextWindow(depth=2)
    cw.add(1, "msg1", "A", "t1")
    cw.add(1, "msg2", "B", "t2")
    cw.clear_chat(1)
    assert cw.get_context(1) == []


def test_active_chats_count():
    """active_chats should return the number of tracked chats."""
    cw = ContextWindow(depth=2)
    assert cw.active_chats == 0
    cw.add(1, "msg", "A", "t1")
    cw.add(2, "msg", "B", "t1")
    assert cw.active_chats == 2


def test_context_entries():
    """get_context_entries should return ContextEntry objects."""
    cw = ContextWindow(depth=2)
    cw.add(1, "Hello", "Alice", "t1", message_id=10)
    cw.add(1, "World", "Bob", "t2", message_id=11)
    entries = cw.get_context_entries(1)
    assert len(entries) == 1
    assert entries[0].text == "Hello"
    assert entries[0].sender_name == "Alice"
    assert entries[0].message_id == 10


def test_depth_one():
    """depth=1 should only keep 1 context message."""
    cw = ContextWindow(depth=1)
    cw.add(1, "first", "A", "t1")
    cw.add(1, "second", "B", "t2")
    cw.add(1, "third", "C", "t3")
    ctx = cw.get_context(1)
    assert len(ctx) == 1
    assert "B: second" in ctx[0]


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
