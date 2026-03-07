// ============================================
// GROQ INTELLIGENCE SERVICE
// Classifies messages and extracts actionable data
// using Llama 3 via Groq's high-speed API
// ============================================

import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// ============================================
// SYSTEM PROMPT for message classification
// ============================================
const CLASSIFICATION_PROMPT = `You are Bmind, an AI productivity assistant. Your job is to analyze a message from a user's chat platform and classify it.

RULES:
1. Classify the message into exactly ONE category:
   - ACTIONABLE: Contains a task, deadline, meeting, reminder, or something the user needs to DO.
   - LEARNING_REQUISITE: Mentions a subject, exam, study topic, or educational content the user should learn.
   - NOISE: Casual conversation, social media, memes, irrelevant chatter.

2. If ACTIONABLE, extract:
   - "task": A clear, concise task title (max 10 words)
   - "deadline": ISO 8601 timestamp if mentioned, otherwise null
   - "importance": 1-5 (5 = most urgent)
   - "context": Brief explanation of where this came from

3. If LEARNING_REQUISITE, extract:
   - "subject": The academic/professional subject (e.g., "Biology", "Machine Learning")
   - "query": A search query for finding educational content

4. If NOISE, return minimal data.

RESPOND WITH VALID JSON ONLY. No markdown, no explanation. Use this exact schema:
{
  "classification": "ACTIONABLE" | "LEARNING_REQUISITE" | "NOISE",
  "data": { ... }
}`;

/**
 * Classify a single message using Groq (Llama 3).
 * @param {string} anonymizedText - PII-stripped message text
 * @param {string} source - Platform name (gmail, telegram, whatsapp, slack)
 * @returns {Promise<{classification: string, data: object}>}
 */
export async function classifyMessage(anonymizedText, source = 'unknown') {
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: CLASSIFICATION_PROMPT },
                {
                    role: 'user',
                    content: `Source platform: ${source}\nMessage: "${anonymizedText}"`
                }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.1,       // Low temp for consistent classification
            max_tokens: 512,
            response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) {
            throw new Error('Empty response from Groq');
        }

        const result = JSON.parse(responseText);

        // Validate the classification
        const validTypes = ['ACTIONABLE', 'LEARNING_REQUISITE', 'NOISE'];
        if (!validTypes.includes(result.classification)) {
            result.classification = 'NOISE';
        }

        // If deadline couldn't be determined, set to null and flag
        if (result.classification === 'ACTIONABLE' && result.data) {
            if (!result.data.deadline || result.data.deadline === 'null') {
                result.data.deadline = null;
            }
            // Ensure importance is within range
            result.data.importance = Math.max(1, Math.min(5, result.data.importance || 3));
        }

        return result;

    } catch (error) {
        console.error('[Groq] Classification error:', error.message);
        // Fallback: can't classify → treat as noise
        return {
            classification: 'NOISE',
            data: { error: error.message }
        };
    }
}

/**
 * Generate a priority summary from a list of tasks.
 * @param {object[]} tasks - Array of task objects from the database
 * @returns {Promise<{summary: string, priorities: object[]}>}
 */
export async function generatePlanSummary(tasks) {
    if (!tasks || tasks.length === 0) {
        return {
            summary: 'No active tasks. Your schedule is clear!',
            priorities: []
        };
    }

    const taskList = tasks.map((t, i) =>
        `${i + 1}. "${t.title}" — Deadline: ${t.deadline || 'TBD'} — Priority: ${t.priority}/5 — Status: ${t.status}`
    ).join('\n');

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are Bmind, a productivity AI. Given a list of tasks, return a JSON object with:
1. "summary": A brief 1-2 sentence motivational summary of the user's day.
2. "priorities": An array of the top 3 most important tasks, each with "title", "reason" (why it's important), and "estimated_minutes" (your estimate of time needed).

RESPOND WITH VALID JSON ONLY.`
                },
                {
                    role: 'user',
                    content: `Here are my current tasks:\n${taskList}`
                }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            max_tokens: 1024,
            response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content;
        return JSON.parse(responseText);

    } catch (error) {
        console.error('[Groq] Plan generation error:', error.message);
        return {
            summary: 'Could not generate plan. Please check your tasks manually.',
            priorities: tasks.slice(0, 3).map(t => ({
                title: t.title,
                reason: 'Auto-sorted by deadline',
                estimated_minutes: 30
            }))
        };
    }
}
