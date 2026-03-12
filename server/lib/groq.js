// ============================================
// GROQ INTELLIGENCE SERVICE v2
// "Thalamus Filter" — 5-category classification
// Batch processing, Ghost Card confidence, Focus Session search
// ============================================

import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// ============================================
// SYSTEM PROMPT — Thalamus Filter (5 categories)
// ============================================
const THALAMUS_PROMPT = `You are Bmind's "Thalamus" — a tactical intelligence filter. Your job is to analyze a message from a user's chat platform and classify it precisely.

TODAY'S DATE: {{TODAY_DATE}}

CLASSIFICATION RULES:
1. Classify into exactly ONE category:
   - TASK: Requires a specific action from the user (submit, prepare, fix, send, etc.)
   - MEETING: A time-bound appointment, call, or sync (includes "let's meet", "call at 3pm")
   - GOAL: A long-term aspiration, project milestone, or vague ambition ("I want to learn X", "we should eventually...")
   - LEARNING: Mentions a subject, course, exam, study topic, or educational content
   - NOISE: Casual conversation, memes, greetings, non-actionable chatter

2. For TASK, extract:
   - "task": Clear task title (max 10 words)
   - "deadline": ISO 8601 timestamp if mentioned, null otherwise
   - "importance": 1-5 (5 = most urgent)
   - "context": Brief origin explanation
   - "stakeholders": Who assigned or is involved (comma-separated names)

3. For MEETING, extract:
   - "task": Meeting title (e.g., "Team sync with Alex")
   - "deadline": ISO 8601 timestamp of the meeting time
   - "importance": 1-5
   - "context": What the meeting is about
   - "stakeholders": Who is involved

4. For GOAL, extract:
   - "task": Goal description (max 10 words)
   - "deadline": null (goals rarely have hard deadlines)
   - "importance": 1-3 (goals are lower urgency)
   - "context": Why this goal matters

5. For LEARNING, extract:
   - "subject": Main topic (e.g., "SAT English", "Machine Learning")
   - "type": "course", "advice", "article", "video", or "other"
   - "title": Specific learning item title
   - "description": VERY IMPORTANT: Provide actionable advice or suggest 1-2 specific courses/resources for this topic.
   - "query": Search query for finding more content
   - "deadline": ISO 8601 timestamp if there is a test, exam, or deadline mentioned, otherwise null.
   - "task": The name of the exam or study goal (e.g., "Biology SAT") if a deadline exists.

6. For NOISE, return minimal data.

7. CONFIDENCE: Rate your classification confidence:
   - "high": Clear and unambiguous
   - "medium": Likely correct but some ambiguity
   - "low": Uncertain — deadline or intent is vague (e.g., "sometime next week", "we should probably...")

TEMPORAL LOGIC: Interpret relative dates strictly from today's date above.
- "tomorrow" = the day after today
- "this Friday" = the coming Friday
- "next week" = the week starting the Monday after this week

RESPOND WITH VALID JSON ONLY:
{
  "classification": "TASK" | "MEETING" | "GOAL" | "LEARNING" | "NOISE",
  "confidence": "high" | "medium" | "low",
  "data": { ... }
}`;

// ============================================
// BATCH PROMPT — for processing multiple messages at once
// ============================================
const BATCH_PROMPT = `You are Bmind's "Thalamus" — a tactical intelligence filter. You will receive a BATCH of messages from the same chat. Classify EACH message.

TODAY'S DATE: {{TODAY_DATE}}

CATEGORIES: TASK, MEETING, GOAL, LEARNING, NOISE
For each message, extract the relevant data fields as described below:
- TASK/MEETING/GOAL: { task, deadline (ISO 8601 or null), importance (1-5), context, stakeholders }
- LEARNING: { subject, type, title, description (provide advice/courses), query, deadline (ISO 8601 or null for exams), task (exam/goal name) }
- NOISE: { }

CONFIDENCE per item: "high", "medium", or "low"

RESPOND WITH VALID JSON — an array of results:
[
  { "index": 0, "classification": "...", "confidence": "...", "data": { ... } },
  { "index": 1, "classification": "...", "confidence": "...", "data": { ... } },
  ...
]`;

/**
 * Get today's date string for temporal logic injection.
 */
function getTodayString() {
    const d = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Classify a single message using the Thalamus filter.
 */
export async function classifyMessage(anonymizedText, source = 'unknown') {
    try {
        const systemPrompt = THALAMUS_PROMPT.replace('{{TODAY_DATE}}', getTodayString());

        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Source platform: ${source}\nMessage: "${anonymizedText}"` }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.1,
            max_tokens: 512,
            response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) throw new Error('Empty response from Groq');

        const result = JSON.parse(responseText);

        // Validate classification
        const validTypes = ['TASK', 'MEETING', 'GOAL', 'LEARNING', 'NOISE'];
        if (!validTypes.includes(result.classification)) {
            result.classification = 'NOISE';
        }

        // Validate confidence
        if (!['high', 'medium', 'low'].includes(result.confidence)) {
            result.confidence = 'medium';
        }

        // Normalize deadline
        if (['TASK', 'MEETING', 'GOAL'].includes(result.classification) && result.data) {
            if (!result.data.deadline || result.data.deadline === 'null') {
                result.data.deadline = null;
            }
            result.data.importance = Math.max(1, Math.min(5, result.data.importance || 3));
        }

        return result;

    } catch (error) {
        console.error('[Groq] Classification error:', error.message);
        return { classification: 'NOISE', confidence: 'low', data: { error: error.message } };
    }
}

/**
 * Classify a BATCH of messages (cost-efficient for TDLib stream).
 * @param {Array<{text: string, senderName: string}>} messages
 * @param {string} source - Platform name
 * @returns {Promise<Array<{classification, confidence, data}>>}
 */
export async function classifyBatch(messages, source = 'telegram') {
    if (!messages || messages.length === 0) return [];

    // For very small batches, just classify individually
    if (messages.length === 1) {
        const result = await classifyMessage(messages[0].text, source);
        return [result];
    }

    try {
        const systemPrompt = BATCH_PROMPT.replace('{{TODAY_DATE}}', getTodayString());

        const batchText = messages.map((m, i) =>
            `[${i}] (${m.senderName || 'Unknown'}): "${m.text}"`
        ).join('\n');

        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Source: ${source}\n\nMessages:\n${batchText}` }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.1,
            max_tokens: 2048,
            response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) throw new Error('Empty batch response');

        const parsed = JSON.parse(responseText);

        // Handle both array and {results: [...]} formats from the LLM
        const results = Array.isArray(parsed) ? parsed : (parsed.results || parsed.classifications || []);

        // Ensure we have results for every message
        return messages.map((_, i) => {
            const r = results.find(r => r.index === i) || results[i];
            if (!r) return { classification: 'NOISE', confidence: 'low', data: {} };

            const validTypes = ['TASK', 'MEETING', 'GOAL', 'LEARNING', 'NOISE'];
            if (!validTypes.includes(r.classification)) r.classification = 'NOISE';
            if (!['high', 'medium', 'low'].includes(r.confidence)) r.confidence = 'medium';

            return r;
        });

    } catch (error) {
        console.error('[Groq] Batch classification error:', error.message);
        // Fallback: classify each individually
        const results = [];
        for (const msg of messages) {
            results.push(await classifyMessage(msg.text, source));
        }
        return results;
    }
}

/**
 * Generate a priority summary from a list of tasks.
 */
export async function generatePlanSummary(tasks) {
    if (!tasks || tasks.length === 0) {
        return { summary: 'No active tasks. Your schedule is clear!', priorities: [] };
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
                { role: 'user', content: `Here are my current tasks:\n${taskList}` }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            max_tokens: 1024,
            response_format: { type: 'json_object' },
        });

        return JSON.parse(completion.choices[0]?.message?.content);

    } catch (error) {
        console.error('[Groq] Plan generation error:', error.message);
        return {
            summary: 'Could not generate plan. Please check your tasks manually.',
            priorities: tasks.slice(0, 3).map(t => ({
                title: t.title, reason: 'Auto-sorted by deadline', estimated_minutes: 30
            }))
        };
    }
}

/**
 * Generate a personalized Focus Session plan for the user.
 */
export async function generateFocusSession(tasks, masteryItems, localTime) {
    const taskContext = tasks?.length ? tasks.map((t, i) =>
        `Task ${i + 1}: "${t.title}" (Due: ${t.deadline || 'None'}, Priority: ${t.priority}/5, Category: ${t.category || 'task'})`
    ).join('\n') : 'No pending tasks.';

    const masteryContext = masteryItems?.length ? masteryItems.map((m, i) =>
        `Topic ${i + 1}: [${m.subject || 'General'} - ${m.resourceType || 'other'}] "${m.title}" - ${m.description || ''}`
    ).join('\n') : 'No recent learning items.';

    const prompt = `You are Bmind, an elite AI productivity coach crafting a "Focus Session".
The user clicked "Start Focus Session" at: ${localTime}.

Active tasks:\n${taskContext}

Recent learning topics:\n${masteryContext}

Generate a JSON with:
1. "greeting": Sharp, time-aware greeting to trigger flow state.
2. "daily_advice": 2-3 sentences of strategic coaching advice.
3. "recommended_lessons": Array of 1-3 lessons (each: "title", "type", "reasoning").
4. "priority_tasks": Array of 1-3 tasks (each: "title", "action_step").

RESPOND ONLY IN VALID JSON.`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.4,
            max_tokens: 1024,
            response_format: { type: 'json_object' },
        });
        return JSON.parse(completion.choices[0]?.message?.content);
    } catch (error) {
        console.error('[Groq] Focus session error:', error.message);
        return {
            greeting: "Focus mode engaged.",
            daily_advice: "Clear distractions and focus on your top priorities.",
            recommended_lessons: [],
            priority_tasks: tasks.slice(0, 3).map(t => ({ title: t.title, action_step: "Begin." }))
        };
    }
}

/**
 * Generate Focus Session search queries for a specific topic.
 * Used when user starts focus on a specific Pulse item.
 */
export async function generateFocusSearchQueries(topic, context = '') {
    const prompt = `You are Bmind. The user wants to deeply focus on this topic:
"${topic}"
${context ? `Context: ${context}` : ''}

Generate a JSON with:
1. "search_queries": Array of 3 optimized YouTube/Google search strings
2. "micro_wins": Array of 3 actionable micro-steps to start RIGHT NOW (each: "step", "time_minutes")
3. "difficulty_levels": Array of 3 resource suggestions ranked by difficulty (each: "title", "level" (Beginner/Intermediate/Expert), "description")

RESPOND ONLY IN VALID JSON.`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            max_tokens: 1024,
            response_format: { type: 'json_object' },
        });
        return JSON.parse(completion.choices[0]?.message?.content);
    } catch (error) {
        console.error('[Groq] Search query generation error:', error.message);
        return {
            search_queries: [`${topic} tutorial`, `${topic} guide 2026`, `${topic} explained simply`],
            micro_wins: [{ step: 'Open a blank document and write 3 bullet points', time_minutes: 5 }],
            difficulty_levels: [{ title: topic, level: 'Beginner', description: 'Start with the basics.' }]
        };
    }
}
