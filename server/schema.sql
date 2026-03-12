-- ============================================
-- BMIND DATABASE SCHEMA v2
-- Run this in the Supabase SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT UNIQUE,
    display_name    TEXT,
    avatar_url      TEXT,

    gmail_connected     BOOLEAN DEFAULT FALSE,
    telegram_connected  BOOLEAN DEFAULT FALSE,
    whatsapp_connected  BOOLEAN DEFAULT FALSE,
    slack_connected     BOOLEAN DEFAULT FALSE,

    -- TDLib session (full Telegram access)
    tdlib_connected     BOOLEAN DEFAULT FALSE,
    tdlib_phone         TEXT,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RAW_MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS raw_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,

    source          TEXT NOT NULL CHECK (source IN ('gmail', 'telegram', 'whatsapp', 'slack', 'manual')),
    raw_text        TEXT NOT NULL,
    sender_name     TEXT,
    conversation    TEXT,
    chat_id         TEXT,                  -- TDLib chat ID for batch grouping

    -- Classification (5-category Thalamus filter)
    classification  TEXT CHECK (classification IN ('TASK', 'MEETING', 'GOAL', 'LEARNING', 'NOISE',
                                                   'ACTIONABLE', 'LEARNING_REQUISITE')),
    processed       BOOLEAN DEFAULT FALSE,

    source_timestamp TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_messages_unprocessed
    ON raw_messages (user_id, processed) WHERE processed = FALSE;

CREATE INDEX IF NOT EXISTS idx_raw_messages_chat_batch
    ON raw_messages (user_id, chat_id, processed) WHERE processed = FALSE;

-- ============================================
-- TASKS TABLE (now covers tasks, meetings, goals)
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,

    title           TEXT NOT NULL,
    deadline        TIMESTAMPTZ,
    priority        INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'archived')),
    importance      INTEGER DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),

    -- Category: task, meeting, or goal
    category        TEXT DEFAULT 'task' CHECK (category IN ('task', 'meeting', 'goal')),

    -- Ghost Card: AI is unsure about deadline/interpretation
    ghost           BOOLEAN DEFAULT FALSE,
    confidence      TEXT DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low')),

    -- Stakeholders extracted by AI
    stakeholders    TEXT,

    source_link     TEXT,
    source_message_id UUID REFERENCES raw_messages(id) ON DELETE SET NULL,
    context         TEXT,
    needs_clarification BOOLEAN DEFAULT FALSE,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_upcoming
    ON tasks (user_id, status, deadline, priority);

-- ============================================
-- MASTERY_VAULT TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS mastery_vault (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,

    title           TEXT NOT NULL,
    url             TEXT,
    resource_type   TEXT DEFAULT 'article' CHECK (resource_type IN ('video', 'article', 'course', 'document', 'advice', 'other')),
    subject         TEXT,
    description     TEXT,

    progress        INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    status          TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mastery_subject
    ON mastery_vault (user_id, subject);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastery_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own messages" ON raw_messages
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert messages" ON raw_messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own tasks" ON tasks
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service can insert tasks" ON tasks
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own mastery" ON mastery_vault
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own mastery" ON mastery_vault
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service can insert mastery" ON mastery_vault
    FOR INSERT WITH CHECK (true);

-- ============================================
-- HELPER: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER mastery_vault_updated_at
    BEFORE UPDATE ON mastery_vault
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
