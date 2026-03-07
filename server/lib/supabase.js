// ============================================
// SUPABASE CLIENT
// Shared database client for all services
// ============================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// HELPER: Insert a raw message
// ============================================
export async function insertRawMessage({ userId, source, rawText, senderName, conversation, sourceTimestamp }) {
    const { data, error } = await supabase
        .from('raw_messages')
        .insert({
            user_id: userId,
            source,
            raw_text: rawText,
            sender_name: senderName || null,
            conversation: conversation || null,
            source_timestamp: sourceTimestamp || new Date().toISOString(),
        })
        .select()
        .single();

    if (error) throw new Error(`Supabase insert raw_message failed: ${error.message}`);
    return data;
}

// ============================================
// HELPER: Insert a task
// ============================================
export async function insertTask({ userId, title, deadline, priority, importance, context, sourceLink, sourceMessageId }) {
    const needsClarification = !deadline;

    const { data, error } = await supabase
        .from('tasks')
        .insert({
            user_id: userId,
            title,
            deadline: deadline || null,
            priority: priority || 3,
            importance: importance || 3,
            context: context || null,
            source_link: sourceLink || null,
            source_message_id: sourceMessageId || null,
            needs_clarification: needsClarification,
        })
        .select()
        .single();

    if (error) throw new Error(`Supabase insert task failed: ${error.message}`);
    return data;
}

// ============================================
// HELPER: Insert a mastery resource
// ============================================
export async function insertMasteryResource({ userId, taskId, title, url, resourceType, subject, description }) {
    const { data, error } = await supabase
        .from('mastery_vault')
        .insert({
            user_id: userId,
            task_id: taskId || null,
            title,
            url: url || null,
            resource_type: resourceType || 'article',
            subject: subject || null,
            description: description || null,
        })
        .select()
        .single();

    if (error) throw new Error(`Supabase insert mastery_vault failed: ${error.message}`);
    return data;
}

// ============================================
// HELPER: Mark raw message as processed
// ============================================
export async function markMessageProcessed(messageId, classification) {
    const { error } = await supabase
        .from('raw_messages')
        .update({ processed: true, classification })
        .eq('id', messageId);

    if (error) throw new Error(`Supabase update raw_message failed: ${error.message}`);
}

// ============================================
// HELPER: Get upcoming tasks for a user
// ============================================
export async function getUpcomingTasks(userId, limit = 10) {
    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'in_progress'])
        .order('deadline', { ascending: true, nullsFirst: false })
        .order('priority', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`Supabase query tasks failed: ${error.message}`);
    return data || [];
}
