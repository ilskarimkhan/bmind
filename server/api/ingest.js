// ============================================
// INGEST API
// POST /api/ingest
// Accepts raw message text, anonymizes, classifies, stores
// ============================================

import { Router } from 'express';
import { insertRawMessage, insertTask, insertMasteryResource, markMessageProcessed } from '../lib/supabase.js';
import { anonymize } from '../lib/anonymizer.js';
import { classifyMessage } from '../lib/groq.js';

const router = Router();

/**
 * Shared function to process a classification result.
 * Used by both the API endpoint and the workers.
 */
export async function processClassification(userId, rawMessageId, classification, sourceLink) {
    // Mark the raw message as processed
    await markMessageProcessed(rawMessageId, classification.classification);

    if (classification.classification === 'ACTIONABLE' && classification.data) {
        // Insert as a task
        await insertTask({
            userId,
            title: classification.data.task || 'Untitled Task',
            deadline: classification.data.deadline || null,
            priority: classification.data.importance || 3,
            importance: classification.data.importance || 3,
            context: classification.data.context || null,
            sourceLink,
            sourceMessageId: rawMessageId,
        });
    }

    if (classification.classification === 'LEARNING_REQUISITE' && classification.data) {
        // Insert as a mastery resource
        await insertMasteryResource({
            userId,
            taskId: null,
            title: classification.data.subject || 'Learning Resource',
            url: null,
            resourceType: 'other',
            subject: classification.data.subject || null,
            description: classification.data.query || null,
        });
    }
}

/**
 * POST /api/ingest
 * Body: { userId, source, text, senderName?, conversation?, sourceTimestamp? }
 */
router.post('/', async (req, res) => {
    try {
        const { userId, source, text, senderName, conversation, sourceTimestamp } = req.body;

        // Validation
        if (!userId || !source || !text) {
            return res.status(400).json({
                error: 'Missing required fields: userId, source, text'
            });
        }

        const validSources = ['gmail', 'telegram', 'whatsapp', 'slack'];
        if (!validSources.includes(source)) {
            return res.status(400).json({
                error: `Invalid source. Must be one of: ${validSources.join(', ')}`
            });
        }

        // 1. Insert raw message
        const rawMsg = await insertRawMessage({
            userId,
            source,
            rawText: text,
            senderName: senderName || null,
            conversation: conversation || null,
            sourceTimestamp: sourceTimestamp || null,
        });

        // 2. Anonymize
        const { anonymized, replacements } = anonymize(text);

        // 3. Classify via Groq
        const classification = await classifyMessage(anonymized, source);

        // 4. Process classification result (insert task or mastery resource)
        await processClassification(userId, rawMsg.id, classification, `${source}:manual`);

        // 5. Respond
        res.json({
            success: true,
            messageId: rawMsg.id,
            classification: classification.classification,
            data: classification.data,
            anonymizedPreview: anonymized.substring(0, 200),
        });

    } catch (error) {
        console.error('[Ingest API] Error:', error.message);
        res.status(500).json({ error: 'Internal server error', detail: error.message });
    }
});

export default router;
