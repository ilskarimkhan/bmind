// ============================================
// BMIND SERVER — Entry Point
// Express server mounting all API routes
// ============================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import ingestRouter from './api/ingest.js';
import generatePlanRouter from './api/generate-plan.js';
import authRouter from './api/auth.js';
import { getTokensFromCode, fetchUnreadMessages } from './workers/gmail.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'],
    credentials: true,
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================
// API ROUTES
// ============================================

// Auth (signup, login, connect platforms)
app.use('/api/auth', authRouter);

// Core intelligence endpoints
app.use('/api/ingest', ingestRouter);
app.use('/api/generate-plan', generatePlanRouter);

// Gmail OAuth callback (needs to be a top-level GET for redirect)
app.get('/api/auth/gmail/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) return res.status(400).json({ error: 'Missing auth code' });

        const tokens = await getTokensFromCode(code);
        // Return an HTML page that sends tokens back to the opener window
        res.send(`
            <html><body><script>
                window.opener.postMessage({ type: 'GMAIL_CONNECTED', tokens: ${JSON.stringify(tokens)} }, '*');
                window.close();
            </script><p>Gmail connected! You can close this window.</p></body></html>
        `);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Manual trigger: fetch Gmail messages (for testing)
app.post('/api/workers/gmail/fetch', async (req, res) => {
    try {
        const { userId, tokens } = req.body;
        if (!userId || !tokens) {
            return res.status(400).json({ error: 'Missing userId or tokens' });
        }
        const results = await fetchUnreadMessages(tokens, userId);
        res.json({ success: true, processed: results.length, results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ---- Health Check ----
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'bmind-server',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║  🧠 Bmind Intelligence Server        ║');
    console.log(`  ║  Running on http://localhost:${PORT}    ║`);
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');
    console.log('  Endpoints:');
    console.log(`  POST /api/auth/signup     — Create account`);
    console.log(`  POST /api/auth/login      — Sign in`);
    console.log(`  GET  /api/auth/me         — Current user`);
    console.log(`  POST /api/auth/connect/*  — Connect platforms`);
    console.log(`  POST /api/ingest          — Classify a message`);
    console.log(`  GET  /api/generate-plan   — Get top 3 priorities`);
    console.log(`  GET  /api/health          — Health check`);
    console.log('');
});

export default app;
