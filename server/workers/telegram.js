// ============================================
// TELEGRAM WORKER
// Listens for incoming messages via Telegraf bot
// ============================================

import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { insertRawMessage, supabaseAdmin } from '../lib/supabase.js';
import { anonymize } from '../lib/anonymizer.js';
import { classifyMessage } from '../lib/groq.js';
import { processClassification } from '../api/ingest.js';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

let bot = null;

/**
 * Start the Telegram bot listener.
 */
export function startTelegramWorker() {
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

            let userId;
            const senderUsername = message.from.username?.toLowerCase();
            
            if (senderUsername) {
                try {
                    const { data: matchedUsers, error } = await supabaseAdmin
                        .from('users')
                        .select('id')
                        .eq('telegram_username', senderUsername)
                        .limit(1);
                        
                    if (!error && matchedUsers && matchedUsers.length > 0) {
                        userId = matchedUsers[0].id;
                    }
                } catch (e) {
                    // Column might not exist yet, fallback will run
                    console.log('[Telegram] Could not lookup by username, falling back...');
                }
            }
            
            if (!userId) {
                // Fallback for single-user environment
                const { data: connectedUsers } = await supabaseAdmin.from('users').select('id').eq('telegram_connected', true).limit(1);
                if (connectedUsers && connectedUsers.length > 0) {
                    userId = connectedUsers[0].id;
                } else {
                    const { data: anyUsers } = await supabaseAdmin.from('users').select('id').limit(1);
                    if (anyUsers && anyUsers.length > 0) {
                        userId = anyUsers[0].id;
                    } else {
                        console.log('[Telegram] No users found in database to associate with message.');
                        return;
                    }
                }
            }

            // Insert raw message
            const rawMsg = await insertRawMessage({
                userId,
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
                userId,
                rawMsg.id,
                classification,
                `telegram:${message.chat.id}:${message.message_id}`
            );

            // Optional: confirm receipt in chat
            if (['TASK', 'MEETING', 'GOAL'].includes(classification.classification)) {
                let reply = `✅ Bmind detected a ${classification.classification.toLowerCase()}: "${classification.data?.task || rawText.substring(0, 30)}"`;
                if (classification.data?.deadline) {
                    const d = new Date(classification.data.deadline);
                    reply += `\n📅 Deadline: ${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                }
                await ctx.reply(reply, { reply_to_message_id: message.message_id });
            } else if (['LEARNING', 'LEARNING_REQUISITE'].includes(classification.classification)) {
                let reply = `📚 Bmind analyzed learning topic: "${classification.data?.subject || 'General'}"`;
                if (classification.data?.deadline) {
                    const d = new Date(classification.data.deadline);
                    reply += `\n📅 Exam/Deadline: ${d.toLocaleDateString()}`;
                }
                if (classification.data?.description) {
                    reply += `\n💡 Advice: ${classification.data.description}`;
                }
                await ctx.reply(reply, { reply_to_message_id: message.message_id });
            }

        } catch (error) {
            console.error('[Telegram] Processing error:', error.message);
        }
    });

    // Launch the bot — drop pending updates to avoid replaying old messages on restart
    bot.launch({ dropPendingUpdates: true })
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
