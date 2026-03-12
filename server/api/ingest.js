// ============================================
// INGEST API v2
// POST /api/ingest
// Processes messages with 5-category Thalamus filter
// ============================================

import { Router } from 'express';
import { insertRawMessage, insertTask, insertMasteryResource, markMessageProcessed } from '../lib/supabase.js';
import { anonymize } from '../lib/anonymizer.js';
import { classifyMessage } from '../lib/groq.js';

const router = Router();

/**
 * Map classification category to task category.
 */
function classificationToCategory(classification) {
    switch (classification) {
        case 'TASK': case 'ACTIONABLE': return 'task';
        case 'MEETING': return 'meeting';
        case 'GOAL': return 'goal';
        default: return 'task';
    }
}

/**
 * Shared function to process a Thalamus classification result.
 * Used by both the API endpoint and TDLib/Telegram workers.
 */
export async function processClassification(userId, rawMessageId, classification, sourceLink) {
    // Mark the raw message as processed
    await markMessageProcessed(rawMessageId, classification.classification);

    const cls = classification.classification;
    const data = classification.data || {};
    const confidence = classification.confidence || 'high';
    const isGhost = confidence === 'low';

    // TASK, MEETING, or GOAL → insert into tasks table
    if (['TASK', 'MEETING', 'GOAL', 'ACTIONABLE'].includes(cls)) {
        await insertTask({
            userId,
            title: data.task || 'Untitled Item',
            deadline: data.deadline || null,
            priority: data.importance || 3,
            importance: data.importance || 3,
            context: data.context || null,
            sourceLink,
            sourceMessageId: rawMessageId,
            category: classificationToCategory(cls),
            ghost: isGhost,
            confidence,
            stakeholders: data.stakeholders || null,
        });
    }

    // LEARNING → insert into mastery_vault
    if (['LEARNING', 'LEARNING_REQUISITE'].includes(cls)) {
        const validResourceTypes = ['video', 'article', 'course', 'document', 'advice', 'other'];
        let rType = (data.type || 'other').toLowerCase();
        if (!validResourceTypes.includes(rType)) {
            rType = 'other';
        }

        await insertMasteryResource({
            userId,
            taskId: null,
            title: data.title || data.subject || 'Learning Resource',
            url: null,
            resourceType: rType,
            subject: data.subject || null,
            description: data.description || data.query || null,
        });

        // If the learning item has a deadline (e.g. an exam), create a goal/task for it too
        if (data.deadline && data.task) {
            await insertTask({
                userId,
                title: data.task,
                deadline: data.deadline,
                priority: 4, // Exams are usually high priority
                importance: 4,
                context: `Auto-generated from learning requirement: ${data.subject || data.task}`,
                sourceLink,
                sourceMessageId: rawMessageId,
                category: 'goal', // Classify exams as goals or tasks
                ghost: isGhost,
                confidence,
                stakeholders: null,
            });
        }
    }
}

/**
 * POST /api/ingest
 * Body: { userId, source, text, senderName?, conversation?, sourceTimestamp?, chatId? }
 */
router.post('/', async (req, res) => {
    try {
        const { userId, source, text, senderName, conversation, sourceTimestamp, chatId } = req.body;

        if (!userId || !source || !text) {
            return res.status(400).json({ error: 'Missing required fields: userId, source, text' });
        }

        const validSources = ['gmail', 'telegram', 'whatsapp', 'slack', 'manual'];
        if (!validSources.includes(source)) {
            return res.status(400).json({ error: `Invalid source. Must be one of: ${validSources.join(', ')}` });
        }

        // 1. Insert raw message
        const rawMsg = await insertRawMessage({
            userId, source,
            rawText: text,
            senderName: senderName || null,
            conversation: conversation || null,
            sourceTimestamp: sourceTimestamp || null,
            chatId: chatId || null,
        });

        // 2. Anonymize
        const { anonymized } = anonymize(text);

        // 3. Classify via Groq Thalamus
        const classification = await classifyMessage(anonymized, source);

        // 4. Process result
        await processClassification(userId, rawMsg.id, classification, `${source}:manual`);

        // 5. Respond
        res.json({
            success: true,
            messageId: rawMsg.id,
            classification: classification.classification,
            confidence: classification.confidence,
            data: classification.data,
            ghost: classification.confidence === 'low',
        });

    } catch (error) {
        console.error('[Ingest API] Error:', error.message);
        res.status(500).json({ error: 'Internal server error', detail: error.message });
    }
});

export default router;
