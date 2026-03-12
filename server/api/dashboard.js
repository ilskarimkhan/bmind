// ============================================
// DASHBOARD API
// GET /api/dashboard?userId=<uuid>
// Returns real tasks + Groq-generated plan for the dashboard
// ============================================

import { Router } from 'express';
import { supabaseAdmin, getUpcomingTasks } from '../lib/supabase.js';
import { generatePlanSummary } from '../lib/groq.js';

const router = Router();

/**
 * GET /api/dashboard?userId=<uuid>
 * Returns full dashboard data: tasks, priorities, stats, connections
 */
router.get('/', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        // 1. Fetch user profile + connections
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        // 2. Fetch upcoming tasks
        const tasks = await getUpcomingTasks(userId, 20);

        // 3. Fetch recent raw messages for the action feed
        const { data: recentMessages } = await supabaseAdmin
            .from('raw_messages')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

        // 4. Fetch mastery resources (library)
        const { data: masteryItems } = await supabaseAdmin
            .from('mastery_vault')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(6);

        // 5. Generate AI priority plan via Groq
        let plan = { summary: 'Your schedule is clear — great time to get ahead!', priorities: [] };
        if (tasks.length > 0) {
            plan = await generatePlanSummary(tasks);
        }

        // 6. Stats
        const stats = {
            totalTasks: tasks.length,
            actionable: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
            dueToday: tasks.filter(t => {
                if (!t.deadline) return false;
                const d = new Date(t.deadline);
                const now = new Date();
                return d.toDateString() === now.toDateString();
            }).length,
            connections: {
                gmail: profile?.gmail_connected || false,
                telegram: profile?.telegram_connected || false,
                whatsapp: profile?.whatsapp_connected || false,
                slack: profile?.slack_connected || false,
            },
            messagesToday: (recentMessages || []).filter(m => {
                const d = new Date(m.created_at);
                return d.toDateString() === new Date().toDateString();
            }).length,
        };

        res.json({
            success: true,
            user: {
                displayName: profile?.display_name || 'User',
                email: profile?.email,
                ...stats,
            },
            plan: {
                summary: plan.summary,
                priorities: plan.priorities || [],
            },
            tasks: tasks.map(t => ({
                id: t.id,
                title: t.title,
                deadline: t.deadline,
                priority: t.priority,
                status: t.status,
                context: t.context,
                source: t.source_link?.split(':')?.[0] || 'manual',
                needsClarification: t.needs_clarification,
                category: t.category || 'task',
                ghost: t.ghost || false,
                confidence: t.confidence || 'high',
                stakeholders: t.stakeholders || null,
            })),
            recentMessages: (recentMessages || []).map(m => ({
                id: m.id,
                source: m.source,
                preview: m.raw_text?.substring(0, 100),
                classification: m.classification,
                senderName: m.sender_name,
                conversation: m.conversation,
                timestamp: m.created_at,
            })),
            masteryItems: (masteryItems || []).map(m => ({
                id: m.id,
                title: m.title,
                subject: m.subject,
                description: m.description,
                resourceType: m.resource_type,
            })),
        });

    } catch (err) {
        console.error('[Dashboard API] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/dashboard/analyze
 * Manually submit a message for analysis (test endpoint)
 */
router.post('/analyze', async (req, res) => {
    try {
        const { userId, text, source } = req.body;
        if (!userId || !text) return res.status(400).json({ error: 'Missing userId or text' });

        const { insertRawMessage } = await import('../lib/supabase.js');
        const { anonymize } = await import('../lib/anonymizer.js');
        const { classifyMessage } = await import('../lib/groq.js');
        const { processClassification } = await import('../api/ingest.js');

        const rawMsg = await insertRawMessage({
            userId, source: source || 'manual',
            rawText: text, senderName: null,
            conversation: 'Manual Input', sourceTimestamp: new Date().toISOString(),
        });

        const { anonymized } = anonymize(text);
        const classification = await classifyMessage(anonymized, source || 'manual');

        await processClassification(userId, rawMsg.id, classification, 'manual:input');

        res.json({
            success: true,
            classification: classification.classification,
            confidence: classification.confidence,
            ghost: classification.confidence === 'low',
            data: classification.data,
        });

    } catch (err) {
        console.error('[Dashboard Analyze] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/dashboard/message/:id
 * Delete a raw message and its associated tasks from the feed.
 */
router.delete('/message/:id', async (req, res) => {
    try {
        const messageId = req.params.id;
        if (!messageId) return res.status(400).json({ error: 'Missing message ID' });

        // Delete associated tasks first (due to foreign key or just clean up)
        await supabaseAdmin
            .from('tasks')
            .delete()
            .eq('source_message_id', messageId);

        // Delete the raw message
        const { error } = await supabaseAdmin
            .from('raw_messages')
            .delete()
            .eq('id', messageId);

        if (error) throw new Error(error.message);

        res.json({ success: true, message: 'Message deleted.' });
    } catch (err) {
        console.error('[Dashboard Delete] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/dashboard/solidify
 * Confirm a Ghost Card — make it a solid task
 */
router.post('/solidify', async (req, res) => {
    try {
        const { taskId } = req.body;
        if (!taskId) return res.status(400).json({ error: 'Missing taskId' });

        const { solidifyTask } = await import('../lib/supabase.js');
        await solidifyTask(taskId);

        res.json({ success: true, message: 'Ghost card solidified.' });
    } catch (err) {
        console.error('[Dashboard Solidify] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/dashboard/dismiss
 * Dismiss a Ghost Card — archive it
 */
router.post('/dismiss', async (req, res) => {
    try {
        const { taskId } = req.body;
        if (!taskId) return res.status(400).json({ error: 'Missing taskId' });

        const { dismissTask } = await import('../lib/supabase.js');
        await dismissTask(taskId);

        res.json({ success: true, message: 'Ghost card dismissed.' });
    } catch (err) {
        console.error('[Dashboard Dismiss] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/dashboard/archive?userId=<uuid>
 */
router.get('/archive', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const { data: completedTasks } = await supabaseAdmin
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .in('status', ['completed', 'archived'])
            .order('updated_at', { ascending: false })
            .limit(20);

        const { data: processedMessages } = await supabaseAdmin
            .from('raw_messages')
            .select('*')
            .eq('user_id', userId)
            .eq('processed', true)
            .order('created_at', { ascending: false })
            .limit(30);

        res.json({
            success: true,
            completedTasks: (completedTasks || []).map(t => ({
                id: t.id, title: t.title, deadline: t.deadline,
                status: t.status, context: t.context, category: t.category,
                source: t.source_link?.split(':')?.[0] || 'manual',
                completedAt: t.updated_at, createdAt: t.created_at,
            })),
            processedMessages: (processedMessages || []).map(m => ({
                id: m.id, source: m.source, preview: m.raw_text?.substring(0, 120),
                classification: m.classification, senderName: m.sender_name,
                conversation: m.conversation, timestamp: m.created_at,
            })),
        });
    } catch (err) {
        console.error('[Dashboard Archive API] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
