-- ============================================
-- BMIND SCHEMA MIGRATION v2
-- Run this in Supabase SQL Editor to upgrade existing tables
-- ============================================

-- 1. Add TDLib/Telegram fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS tdlib_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tdlib_phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username TEXT;

-- 2. Add chat_id to raw_messages for batch grouping
ALTER TABLE raw_messages ADD COLUMN IF NOT EXISTS chat_id TEXT;

-- 3. Drop old classification constraint and add new one
ALTER TABLE raw_messages DROP CONSTRAINT IF EXISTS raw_messages_classification_check;
ALTER TABLE raw_messages ADD CONSTRAINT raw_messages_classification_check
    CHECK (classification IN ('TASK', 'MEETING', 'GOAL', 'LEARNING', 'NOISE', 'ACTIONABLE', 'LEARNING_REQUISITE'));

-- 4. Add new columns to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'task';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ghost BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'high';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS stakeholders TEXT;

-- Add constraints (only if they don't exist — safe to re-run)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tasks_category_check'
    ) THEN
        ALTER TABLE tasks ADD CONSTRAINT tasks_category_check CHECK (category IN ('task', 'meeting', 'goal'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tasks_confidence_check'
    ) THEN
        ALTER TABLE tasks ADD CONSTRAINT tasks_confidence_check CHECK (confidence IN ('high', 'medium', 'low'));
    END IF;
END $$;

-- 5. Add 'advice' to mastery_vault resource_type
ALTER TABLE mastery_vault DROP CONSTRAINT IF EXISTS mastery_vault_resource_type_check;
ALTER TABLE mastery_vault ADD CONSTRAINT mastery_vault_resource_type_check
    CHECK (resource_type IN ('video', 'article', 'course', 'document', 'advice', 'other'));

-- 6. Add index for batch processing
CREATE INDEX IF NOT EXISTS idx_raw_messages_chat_batch
    ON raw_messages (user_id, chat_id, processed) WHERE processed = FALSE;

-- Done!
SELECT 'Migration v2 complete ✅' AS status;
