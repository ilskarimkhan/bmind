// ============================================
// SUPABASE CLIENT v2
// Shared database client for all services
// ============================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export const supabaseAdmin = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })
    : supabase;

if (!serviceRoleKey) {
    console.warn('[Supabase] No SUPABASE_SERVICE_ROLE_KEY set — server-side queries may fail due to RLS.');
}

// ============================================
// Insert a raw message
// ============================================
export async function insertRawMessage({ userId, source, rawText, senderName, conversation, sourceTimestamp, chatId }) {
    const { data, error } = await supabaseAdmin
        .from('raw_messages')
        .insert({
            user_id: userId,
            source,
            raw_text: rawText,
            sender_name: senderName || null,
            conversation: conversation || null,
            source_timestamp: sourceTimestamp || new Date().toISOString(),
            chat_id: chatId || null,
        })
        .select()
        .single();

    if (error) throw new Error(`Supabase insert raw_message failed: ${error.message}`);
    return data;
}

// ============================================
// Insert a task (now supports category, ghost, confidence, stakeholders)
// ============================================
export async function insertTask({ userId, title, deadline, priority, importance, context, sourceLink, sourceMessageId, category, ghost, confidence, stakeholders }) {
    const needsClarification = !deadline || ghost;

    const { data, error } = await supabaseAdmin
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
            category: category || 'task',
            ghost: ghost || false,
            confidence: confidence || 'high',
            stakeholders: stakeholders || null,
        })
        .select()
        .single();

    if (error) throw new Error(`Supabase insert task failed: ${error.message}`);
    return data;
}

// ============================================
// Insert a mastery resource
// ============================================
export async function insertMasteryResource({ userId, taskId, title, url, resourceType, subject, description }) {
    const validTypes = ['video', 'article', 'course', 'document', 'advice', 'other'];
    let safeType = (resourceType || 'article').toLowerCase();
    if (!validTypes.includes(safeType)) safeType = 'other';

    const { data, error } = await supabaseAdmin
        .from('mastery_vault')
        .insert({
            user_id: userId,
            task_id: taskId || null,
            title,
            url: url || null,
            resource_type: safeType,
            subject: subject || null,
            description: description || null,
        })
        .select()
        .single();

    if (error) throw new Error(`Supabase insert mastery_vault failed: ${error.message}`);
    return data;
}

// ============================================
// Mark raw message as processed
// ============================================
export async function markMessageProcessed(messageId, classification) {
    const { error } = await supabaseAdmin
        .from('raw_messages')
        .update({ processed: true, classification })
        .eq('id', messageId);

    if (error) throw new Error(`Supabase update raw_message failed: ${error.message}`);
}

// ============================================
// Get upcoming tasks for a user
// ============================================
export async function getUpcomingTasks(userId, limit = 10) {
    const { data, error } = await supabaseAdmin
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

// ============================================
// Solidify a ghost card (confirm it's real)
// ============================================
export async function solidifyTask(taskId) {
    const { error } = await supabaseAdmin
        .from('tasks')
        .update({ ghost: false, needs_clarification: false, confidence: 'high' })
        .eq('id', taskId);

    if (error) throw new Error(`Supabase solidify task failed: ${error.message}`);
}

// ============================================
// Dismiss a ghost card
// ============================================
export async function dismissTask(taskId) {
    const { error } = await supabaseAdmin
        .from('tasks')
        .update({ status: 'archived' })
        .eq('id', taskId);

    if (error) throw new Error(`Supabase dismiss task failed: ${error.message}`);
}
