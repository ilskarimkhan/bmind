-- ============================================
-- BMIND DATABASE SCHEMA
-- Run this in the Supabase SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- USERS TABLE
-- Tracks auth state and per-platform connection status
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT UNIQUE,
    display_name    TEXT,
    avatar_url      TEXT,

    -- Connection status per platform (boolean flags)
    gmail_connected     BOOLEAN DEFAULT FALSE,
    telegram_connected  BOOLEAN DEFAULT FALSE,
    whatsapp_connected  BOOLEAN DEFAULT FALSE,
    slack_connected     BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RAW_MESSAGES TABLE
-- Logs every incoming message before processing
-- ============================================
CREATE TABLE IF NOT EXISTS raw_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,

    source          TEXT NOT NULL CHECK (source IN ('gmail', 'telegram', 'whatsapp', 'slack')),
    raw_text        TEXT NOT NULL,
    sender_name     TEXT,
    conversation    TEXT,          -- group name or thread subject

    -- Classification result from Groq
    classification  TEXT CHECK (classification IN ('ACTIONABLE', 'LEARNING_REQUISITE', 'NOISE')),
    processed       BOOLEAN DEFAULT FALSE,

    -- Timestamps
    source_timestamp TIMESTAMPTZ,  -- when the original message was sent
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries on unprocessed messages
CREATE INDEX IF NOT EXISTS idx_raw_messages_unprocessed
    ON raw_messages (user_id, processed) WHERE processed = FALSE;

-- ============================================
-- TASKS TABLE
-- Actionable items extracted from messages
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,

    title           TEXT NOT NULL,
    deadline        TIMESTAMPTZ,           -- NULL if undetermined (flagged for user clarification)
    priority        INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'archived')),
    importance      INTEGER DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),

    -- Link back to the source message
    source_link     TEXT,                  -- e.g. "gmail:msg_id_123" or "whatsapp:chat_id"
    source_message_id UUID REFERENCES raw_messages(id) ON DELETE SET NULL,

    -- AI-generated context
    context         TEXT,                  -- e.g. "Biology Paper deadline from Prof. Chen"

    -- Flag for missing deadline
    needs_clarification BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for dashboard queries (upcoming deadlines sorted by priority)
CREATE INDEX IF NOT EXISTS idx_tasks_upcoming
    ON tasks (user_id, status, deadline, priority);

-- ============================================
-- MASTERY_VAULT TABLE
-- Learning resources linked to specific tasks
-- ============================================
CREATE TABLE IF NOT EXISTS mastery_vault (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,

    title           TEXT NOT NULL,
    url             TEXT,
    resource_type   TEXT DEFAULT 'article' CHECK (resource_type IN ('video', 'article', 'course', 'document', 'other')),
    subject         TEXT,                  -- e.g. "Biology", "Mathematics"
    description     TEXT,

    -- Progress tracking
    progress        INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    status          TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),

    -- Optional: vector embedding for semantic search
    -- embedding    vector(1536),

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding resources by subject
CREATE INDEX IF NOT EXISTS idx_mastery_subject
    ON mastery_vault (user_id, subject);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensure users can only access their own data
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastery_vault ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Users can only see their own messages
CREATE POLICY "Users can view own messages" ON raw_messages
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert messages" ON raw_messages
    FOR INSERT WITH CHECK (true);  -- Server-side inserts via service role

-- Users can CRUD their own tasks
CREATE POLICY "Users can view own tasks" ON tasks
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service can insert tasks" ON tasks
    FOR INSERT WITH CHECK (true);

-- Users can CRUD their own mastery items
CREATE POLICY "Users can view own mastery" ON mastery_vault
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own mastery" ON mastery_vault
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service can insert mastery" ON mastery_vault
    FOR INSERT WITH CHECK (true);

-- ============================================
-- HELPER FUNCTION: Auto-update updated_at
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
