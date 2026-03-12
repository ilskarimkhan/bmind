// ============================================
// TDLIB WORKER
// Reads ALL Telegram chats via TDLib (not just bot messages)
// Buffers messages by chat_id, flushes batches to Groq
// ============================================

import { createClient } from 'tdl';
import { getTdjson } from 'prebuilt-tdlib';
import dotenv from 'dotenv';
import { insertRawMessage, supabaseAdmin } from '../lib/supabase.js';
import { anonymize } from '../lib/anonymizer.js';
import { classifyBatch } from '../lib/groq.js';
import { processClassification } from '../api/ingest.js';

dotenv.config();

const API_ID = parseInt(process.env.TELEGRAM_API_ID) || 0;
const API_HASH = process.env.TELEGRAM_API_HASH || '';

// Batch buffer: Map<chatId, {messages: [], timer: Timeout}>
const chatBuffers = new Map();
const BATCH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const BATCH_MAX_SIZE = 20;  // Or flush when 20 messages accumulate

let tdlClient = null;
let isAuthenticated = false;
let currentUserId = null;     // Bmind user ID
let pendingAuthResolve = null; // For auth flow

/**
 * Initialize TDLib client.
 */
export async function initTdlib() {
    if (!API_ID || !API_HASH) {
        console.warn('[TDLib] No TELEGRAM_API_ID or TELEGRAM_API_HASH set. Skipping TDLib.');
        return null;
    }

    try {
        tdlClient = createClient({
            api_id: API_ID,
            api_hash: API_HASH,
            tdlibParameters: {
                use_message_database: true,
                use_secret_chats: false,
                system_language_code: 'en',
                device_model: 'Bmind Server',
                application_version: '2.0.0',
            },
        });

        // Handle incoming updates
        tdlClient.on('update', handleUpdate);
        tdlClient.on('error', (err) => {
            console.error('[TDLib] Error:', err.message || err);
        });

        await tdlClient.connect();
        console.log('[TDLib] Client connected. Awaiting authentication...');

        return tdlClient;
    } catch (err) {
        console.error('[TDLib] Init failed:', err.message);
        return null;
    }
}

/**
 * Send auth code to user's phone.
 */
export async function sendAuthCode(phoneNumber) {
    if (!tdlClient) throw new Error('TDLib not initialized');

    await tdlClient.invoke({
        _: 'setAuthenticationPhoneNumber',
        phone_number: phoneNumber,
    });

    return { success: true, message: 'Code sent to your Telegram app.' };
}

/**
 * Verify auth code.
 */
export async function verifyAuthCode(code) {
    if (!tdlClient) throw new Error('TDLib not initialized');

    await tdlClient.invoke({
        _: 'checkAuthenticationCode',
        code,
    });

    isAuthenticated = true;
    return { success: true };
}

/**
 * Handle TDLib updates.
 */
async function handleUpdate(update) {
    if (update._ === 'updateAuthorizationState') {
        const state = update.authorization_state;
        console.log('[TDLib] Auth state:', state._);

        if (state._ === 'authorizationStateReady') {
            isAuthenticated = true;
            console.log('[TDLib] ✅ Authenticated and listening for messages.');

            // If userId was already set externally (via setCurrentUser), use it
            // Otherwise find the most recently connected Bmind user
            if (!currentUserId) {
                const { data: users } = await supabaseAdmin
                    .from('users')
                    .select('id')
                    .eq('tdlib_connected', true)
                    .order('updated_at', { ascending: false })
                    .limit(1);

                if (users?.length) {
                    currentUserId = users[0].id;
                }
            }

            // Fetch historical chats on connect
            if (currentUserId) {
                fetchHistoricalChats(currentUserId).catch(err =>
                    console.error('[TDLib] Historical sync error:', err.message)
                );
            }
        }
    }

    // New message event — the core of TDLib scraping
    if (update._ === 'updateNewMessage' && isAuthenticated && currentUserId) {
        const msg = update.message;
        if (!msg || !msg.content) return;

        // Only process text messages
        if (msg.content._ !== 'messageText') return;

        const rawText = msg.content.text?.text;
        if (!rawText || rawText.trim().length < 3) return;

        const chatId = String(msg.chat_id);
        const senderName = await getSenderName(msg);
        const sourceTimestamp = new Date(msg.date * 1000).toISOString();

        // Store raw message immediately
        const rawMsg = await insertRawMessage({
            userId: currentUserId,
            source: 'telegram',
            rawText,
            senderName,
            conversation: await getChatTitle(chatId),
            sourceTimestamp,
            chatId,
        });

        // Add to batch buffer
        addToBatchBuffer(chatId, {
            rawMsgId: rawMsg.id,
            text: rawText,
            senderName,
        });
    }
}

/**
 * Add a message to the batch buffer for its chat.
 */
function addToBatchBuffer(chatId, messageData) {
    if (!chatBuffers.has(chatId)) {
        chatBuffers.set(chatId, {
            messages: [],
            timer: setTimeout(() => flushBatch(chatId), BATCH_INTERVAL_MS),
        });
    }

    const buffer = chatBuffers.get(chatId);
    buffer.messages.push(messageData);

    // Flush early if batch is full
    if (buffer.messages.length >= BATCH_MAX_SIZE) {
        clearTimeout(buffer.timer);
        flushBatch(chatId);
    }
}

/**
 * Flush a chat's buffered messages to Groq for batch classification.
 */
async function flushBatch(chatId) {
    const buffer = chatBuffers.get(chatId);
    if (!buffer || buffer.messages.length === 0) {
        chatBuffers.delete(chatId);
        return;
    }

    const messages = [...buffer.messages];
    chatBuffers.delete(chatId); // Clear buffer

    console.log(`[TDLib] Flushing batch of ${messages.length} messages from chat ${chatId}`);

    try {
        // Anonymize all messages
        const anonymized = messages.map(m => ({
            ...m,
            text: anonymize(m.text).anonymized,
        }));

        // Batch classify
        const results = await classifyBatch(anonymized, 'telegram');

        // Process each result
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const msg = messages[i];

            await processClassification(
                currentUserId,
                msg.rawMsgId,
                result,
                `telegram:tdlib:${chatId}`
            );
        }

        console.log(`[TDLib] ✅ Batch processed: ${messages.length} messages, chat ${chatId}`);
    } catch (err) {
        console.error(`[TDLib] Batch processing error for chat ${chatId}:`, err.message);
    }
}

/**
 * Get sender display name.
 */
async function getSenderName(message) {
    try {
        if (message.sender_id?._ === 'messageSenderUser') {
            const user = await tdlClient.invoke({
                _: 'getUser',
                user_id: message.sender_id.user_id,
            });
            return [user.first_name, user.last_name].filter(Boolean).join(' ');
        }
        return 'Unknown';
    } catch {
        return 'Unknown';
    }
}

/**
 * Get chat title by ID.
 */
async function getChatTitle(chatId) {
    try {
        const chat = await tdlClient.invoke({
            _: 'getChat',
            chat_id: parseInt(chatId),
        });
        return chat.title || `Chat ${chatId}`;
    } catch {
        return `Chat ${chatId}`;
    }
}

/**
 * Set the current Bmind user ID (called from auth route after verify-code).
 */
export function setCurrentUser(userId) {
    currentUserId = userId;
    console.log('[TDLib] User associated:', userId);
}

/**
 * Fetch historical messages from all chats and push them through the ingest pipeline.
 * Runs once after TDLib authentication is confirmed.
 */
async function fetchHistoricalChats(userId) {
    if (!tdlClient) return;

    console.log('[TDLib] Starting historical chat sync for user:', userId);

    const DAYS_BACK = 30;
    const cutoff = Date.now() - DAYS_BACK * 24 * 3600 * 1000;
    const MAX_CHATS = 30;
    const MSGS_PER_CHAT = 100;

    try {
        // Get list of chats (sorted by activity)
        const { chat_ids: chatIds } = await tdlClient.invoke({
            _: 'getChats',
            chat_list: { _: 'chatListMain' },
            limit: MAX_CHATS,
        });

        console.log(`[TDLib] Syncing ${chatIds.length} historical chats...`);

        for (const chatId of chatIds) {
            try {
                const history = await tdlClient.invoke({
                    _: 'getChatHistory',
                    chat_id: chatId,
                    limit: MSGS_PER_CHAT,
                    from_message_id: 0,
                    offset: 0,
                    only_local: false,
                });

                const textMessages = (history.messages || [])
                    .filter(m => {
                        // Only process text messages within the cutoff window
                        if (m.content?._ !== 'messageText') return false;
                        const ts = m.date * 1000;
                        return ts >= cutoff;
                    });

                if (textMessages.length === 0) continue;

                const chatTitle = await getChatTitle(String(chatId));

                // Insert all messages as raw, then batch-classify
                const batchItems = [];
                for (const msg of textMessages) {
                    const rawText = msg.content.text?.text;
                    if (!rawText || rawText.trim().length < 3) continue;

                    const senderName = await getSenderName(msg);
                    const sourceTimestamp = new Date(msg.date * 1000).toISOString();

                    try {
                        const rawMsg = await insertRawMessage({
                            userId,
                            source: 'telegram',
                            rawText,
                            senderName,
                            conversation: chatTitle,
                            sourceTimestamp,
                            chatId: String(chatId),
                        });
                        batchItems.push({ rawMsgId: rawMsg.id, text: rawText, senderName });
                    } catch (insertErr) {
                        // Skip duplicates silently
                        if (!insertErr.message?.includes('duplicate')) {
                            console.warn('[TDLib] Insert error:', insertErr.message);
                        }
                    }
                }

                if (batchItems.length === 0) continue;

                // Batch anonymize + classify
                const anonymized = batchItems.map(m => ({
                    ...m,
                    text: anonymize(m.text).anonymized,
                }));

                const results = await classifyBatch(anonymized, 'telegram');

                for (let i = 0; i < results.length; i++) {
                    await processClassification(
                        userId,
                        batchItems[i].rawMsgId,
                        results[i],
                        `telegram:tdlib:${chatId}`
                    );
                }

                console.log(`[TDLib] ✅ Synced ${batchItems.length} messages from: ${chatTitle}`);

                // Small delay to avoid rate limits
                await new Promise(r => setTimeout(r, 500));
            } catch (chatErr) {
                console.warn(`[TDLib] Skipped chat ${chatId}:`, chatErr.message);
            }
        }

        console.log('[TDLib] ✅ Historical sync complete.');
    } catch (err) {
        console.error('[TDLib] Failed to fetch chat list:', err.message);
    }
}

/**
 * Check if TDLib is ready.
 */
export function isTdlibReady() {
    return isAuthenticated && !!currentUserId;
}

/**
 * Stop TDLib.
 */
export async function stopTdlib() {
    // Flush all remaining batches
    for (const [chatId] of chatBuffers) {
        await flushBatch(chatId);
    }

    if (tdlClient) {
        try { await tdlClient.close(); } catch { }
        tdlClient = null;
        isAuthenticated = false;
    }
}
