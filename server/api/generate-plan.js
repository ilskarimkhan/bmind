// ============================================
// GENERATE PLAN API
// GET /api/generate-plan
// Queries tasks and uses Groq to summarize top 3 priorities
// ============================================

import { Router } from 'express';
import { getUpcomingTasks } from '../lib/supabase.js';
import { generatePlanSummary } from '../lib/groq.js';

const router = Router();

/**
 * GET /api/generate-plan?userId=<uuid>
 * Returns a structured plan with top 3 priorities + motivational summary
 */
router.get('/', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                error: 'Missing required query parameter: userId'
            });
        }

        // 1. Fetch upcoming tasks from Supabase
        const tasks = await getUpcomingTasks(userId, 15);

        // 2. Generate plan summary via Groq
        const plan = await generatePlanSummary(tasks);

        // 3. Respond
        res.json({
            success: true,
            totalTasks: tasks.length,
            summary: plan.summary,
            priorities: plan.priorities || [],
            allTasks: tasks.map(t => ({
                id: t.id,
                title: t.title,
                deadline: t.deadline,
                priority: t.priority,
                status: t.status,
                needsClarification: t.needs_clarification,
                context: t.context,
            })),
        });

    } catch (error) {
        console.error('[Generate Plan API] Error:', error.message);
        res.status(500).json({ error: 'Internal server error', detail: error.message });
    }
});

export default router;
