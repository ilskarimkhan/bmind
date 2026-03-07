// ============================================
// WHATSAPP WORKER
// Uses Baileys for QR code login + message listening
// ============================================

import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { insertRawMessage } from '../lib/supabase.js';
import { anonymize } from '../lib/anonymizer.js';
import { classifyMessage } from '../lib/groq.js';
import { processClassification } from '../api/ingest.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, '..', '.wa-auth');

let sock = null;

/**
 * Start the WhatsApp connection.
 * On first run, a QR code will be printed in the terminal.
 * @param {string} defaultUserId - The Bmind user ID
 * @param {function} onQR - Callback for QR code string (for displaying in UI)
 */
export async function startWhatsAppWorker(defaultUserId, onQR = null) {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket.default({
        version,
        auth: state,
        printQRInTerminal: true,  // Prints QR to console
    });

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);

    // Connection updates
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Forward QR code to callback if provided
        if (qr && onQR) {
            onQR(qr);
        }

        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            if (reason === DisconnectReason.loggedOut) {
                console.log('[WhatsApp] Logged out. Please delete .wa-auth and restart.');
            } else {
                console.log('[WhatsApp] Connection closed. Reconnecting...');
                startWhatsAppWorker(defaultUserId, onQR);
            }
        } else if (connection === 'open') {
            console.log('[WhatsApp] Connected successfully!');
        }
    });

    // Listen for incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            try {
                // Skip messages sent by us
                if (msg.key.fromMe) continue;

                // Extract text content
                const rawText = msg.message?.conversation
                    || msg.message?.extendedTextMessage?.text
                    || msg.message?.imageMessage?.caption
                    || null;

                if (!rawText) continue; // Skip non-text messages

                const senderJid = msg.key.remoteJid;
                const senderName = msg.pushName || senderJid;
                const isGroup = senderJid.endsWith('@g.us');
                const conversation = isGroup ? senderJid : `DM with ${senderName}`;
                const sourceTimestamp = new Date(msg.messageTimestamp * 1000).toISOString();

                console.log(`[WhatsApp] Message from ${senderName}: ${rawText.substring(0, 50)}...`);

                // Insert raw message
                const rawMsg = await insertRawMessage({
                    userId: defaultUserId,
                    source: 'whatsapp',
                    rawText,
                    senderName,
                    conversation,
                    sourceTimestamp,
                });

                // Anonymize and classify
                const { anonymized } = anonymize(rawText);
                const classification = await classifyMessage(anonymized, 'whatsapp');

                // Process the result
                await processClassification(
                    defaultUserId,
                    rawMsg.id,
                    classification,
                    `whatsapp:${senderJid}:${msg.key.id}`
                );

            } catch (error) {
                console.error('[WhatsApp] Processing error:', error.message);
            }
        }
    });

    return sock;
}

/**
 * Stop the WhatsApp connection.
 */
export function stopWhatsAppWorker() {
    if (sock) {
        sock.end();
        sock = null;
    }
}
