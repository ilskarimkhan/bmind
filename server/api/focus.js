// ============================================
// FOCUS API
// GET /api/focus/start
// Generates an immersive focus session plan using Groq
// ============================================

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { generateFocusSession, generateFocusSearchQueries } from '../lib/groq.js';

const router = Router();

router.get('/start', async (req, res) => {
    try {
        const { userId, localTime, topic, context } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'Missing userId parameter' });
        }

        const timeString = localTime || new Date().toLocaleString();

        // 1. Fetch pending tasks
        const { data: tasks, error: taskErr } = await supabaseAdmin
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .in('status', ['pending', 'in_progress'])
            .order('priority', { ascending: false })
            .order('deadline', { ascending: true, nullsFirst: false })
            .limit(10);

        if (taskErr) throw taskErr;

        // 2. Fetch recent mastery items
        const { data: masteryItems, error: masteryErr } = await supabaseAdmin
            .from('mastery_vault')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (masteryErr) throw masteryErr;

        // 3. Generate base Focus Session
        const plan = await generateFocusSession(tasks || [], masteryItems || [], timeString);

        // 4. Generate search queries and micro-wins if a specific topic is selected
        if (topic) {
            const searchData = await generateFocusSearchQueries(topic, context || '');
            plan.searchData = searchData;
        }

        return res.json({
            success: true,
            plan
        });

    } catch (error) {
        console.error('[Focus API] Error starting session:', error.message);
        return res.status(500).json({ error: 'Failed to generate focus session.' });
    }
});

export default router;
