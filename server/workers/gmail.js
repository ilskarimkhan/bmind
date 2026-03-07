// ============================================
// GMAIL WORKER
// OAuth2 flow + background fetch of unread messages
// ============================================

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import { insertRawMessage } from '../lib/supabase.js';
import { anonymize } from '../lib/anonymizer.js';
import { classifyMessage } from '../lib/groq.js';
import { processClassification } from '../api/ingest.js';

dotenv.config();

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI;

// ============================================
// Create OAuth2 client
// ============================================
export function createOAuth2Client() {
    return new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

/**
 * Generate the Google OAuth2 consent URL.
 * The user visits this URL to grant access.
 */
export function getAuthUrl() {
    const client = createOAuth2Client();
    return client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/userinfo.email',
        ],
    });
}

/**
 * Exchange the auth code for tokens.
 * @param {string} code - The authorization code from Google
 * @returns {Promise<object>} - Token object
 */
export async function getTokensFromCode(code) {
    const client = createOAuth2Client();
    const { tokens } = await client.getToken(code);
    return tokens;
}

/**
 * Fetch recent unread messages from Gmail.
 * @param {object} tokens - OAuth2 tokens { access_token, refresh_token }
 * @param {string} userId - Bmind user ID
 * @param {number} maxResults - Max messages to fetch
 */
export async function fetchUnreadMessages(tokens, userId, maxResults = 10) {
    const client = createOAuth2Client();
    client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: client });

    try {
        // List recent unread messages
        const listResponse = await gmail.users.messages.list({
            userId: 'me',
            q: 'is:unread',
            maxResults,
        });

        const messages = listResponse.data.messages || [];
        const results = [];

        for (const msg of messages) {
            try {
                // Fetch full message content
                const detail = await gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'full',
                });

                const headers = detail.data.payload?.headers || [];
                const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
                const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
                const dateStr = headers.find(h => h.name === 'Date')?.value;

                // Extract text body
                let body = '';
                const parts = detail.data.payload?.parts || [];
                for (const part of parts) {
                    if (part.mimeType === 'text/plain' && part.body?.data) {
                        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                        break;
                    }
                }
                // Fallback: single-part message
                if (!body && detail.data.payload?.body?.data) {
                    body = Buffer.from(detail.data.payload.body.data, 'base64').toString('utf-8');
                }

                const rawText = `Subject: ${subject}\nFrom: ${from}\n\n${body}`.trim();

                // Insert raw message into DB
                const rawMsg = await insertRawMessage({
                    userId,
                    source: 'gmail',
                    rawText,
                    senderName: from,
                    conversation: subject,
                    sourceTimestamp: dateStr ? new Date(dateStr).toISOString() : null,
                });

                // Anonymize and classify
                const { anonymized } = anonymize(rawText);
                const classification = await classifyMessage(anonymized, 'gmail');

                // Process the result (insert task or mastery resource)
                await processClassification(userId, rawMsg.id, classification, `gmail:${msg.id}`);

                results.push({
                    messageId: msg.id,
                    subject,
                    classification: classification.classification,
                });

            } catch (err) {
                console.error(`[Gmail] Error processing message ${msg.id}:`, err.message);
            }
        }

        return results;

    } catch (error) {
        console.error('[Gmail] Fetch error:', error.message);
        throw error;
    }
}
