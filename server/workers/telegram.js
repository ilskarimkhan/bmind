// ============================================
// TELEGRAM WORKER
// Listens for incoming messages via Telegraf bot
// ============================================

import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { insertRawMessage } from '../lib/supabase.js';
import { anonymize } from '../lib/anonymizer.js';
import { classifyMessage } from '../lib/groq.js';
import { processClassification } from '../api/ingest.js';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

let bot = null;

/**
 * Start the Telegram bot listener.
 * @param {string} defaultUserId - The Bmind user to associate messages with
 */
export function startTelegramWorker(defaultUserId) {
    if (!BOT_TOKEN) {
        console.warn('[Telegram] No TELEGRAM_BOT_TOKEN set. Skipping Telegram worker.');
        return null;
    }

    bot = new Telegraf(BOT_TOKEN);

    // Listen for all text messages
    bot.on('text', async (ctx) => {
        try {
            const message = ctx.message;
            const rawText = message.text;
            const senderName = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ');
            const chatTitle = message.chat.title || `DM with ${senderName}`;
            const sourceTimestamp = new Date(message.date * 1000).toISOString();

            console.log(`[Telegram] Message from ${senderName} in "${chatTitle}": ${rawText.substring(0, 50)}...`);

            // Insert raw message
            const rawMsg = await insertRawMessage({
                userId: defaultUserId,
                source: 'telegram',
                rawText,
                senderName,
                conversation: chatTitle,
                sourceTimestamp,
            });

            // Anonymize and classify
            const { anonymized } = anonymize(rawText);
            const classification = await classifyMessage(anonymized, 'telegram');

            // Process the result
            await processClassification(
                defaultUserId,
                rawMsg.id,
                classification,
                `telegram:${message.chat.id}:${message.message_id}`
            );

            // Optional: confirm receipt in chat
            if (classification.classification === 'ACTIONABLE') {
                await ctx.reply(`✅ Bmind detected a task: "${classification.data?.task || rawText.substring(0, 30)}"`);
            }

        } catch (error) {
            console.error('[Telegram] Processing error:', error.message);
        }
    });

    // Launch the bot
    bot.launch()
        .then(() => console.log('[Telegram] Bot is listening for messages...'))
        .catch(err => console.error('[Telegram] Launch failed:', err.message));

    // Graceful shutdown
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return bot;
}

/**
 * Stop the Telegram bot.
 */
export function stopTelegramWorker() {
    if (bot) {
        bot.stop();
        bot = null;
    }
}
