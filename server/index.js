// ============================================
// BMIND SERVER — Entry Point v2
// ============================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import ingestRouter from './api/ingest.js';
import generatePlanRouter from './api/generate-plan.js';
import authRouter from './api/auth.js';
import dashboardRouter from './api/dashboard.js';
import focusRouter from './api/focus.js';
import tdlibAuthRouter from './api/tdlib-auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARE — allow all origins in dev
// ============================================
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Serve the frontend static files
const frontendDir = path.join(__dirname, '..');
app.use(express.static(frontendDir));
app.use('/pages', express.static(path.join(frontendDir, 'pages')));

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================
// API ROUTES
// ============================================
app.use('/api/auth', authRouter);
app.use('/api/ingest', ingestRouter);
app.use('/api/generate-plan', generatePlanRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/focus', focusRouter);
app.use('/api/tdlib', tdlibAuthRouter);

// Gmail OAuth callback
app.get('/api/auth/gmail/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) return res.status(400).send('<h2>Missing auth code</h2>');
        const { getTokensFromCode } = await import('./workers/gmail.js');
        const tokens = await getTokensFromCode(code);
        res.send(`<html><head><style>
            body{font-family:system-ui;background:#0a0a0f;color:#fff;
            display:flex;align-items:center;justify-content:center;
            height:100vh;margin:0;flex-direction:column;gap:16px;}
            h2{color:#4ade80;margin:0;}p{color:#94a3b8;margin:0;}
        </style></head><body>
            <div style="font-size:48px">✅</div>
            <h2>Gmail Connected!</h2><p>You can close this window.</p>
            <script>
                window.opener&&window.opener.postMessage(
                  {type:'GMAIL_CONNECTED',tokens:${JSON.stringify(tokens)}},'*');
                setTimeout(()=>window.close(),1500);
            </script></body></html>`);
    } catch (err) {
        res.status(500).send(`<h2>Error: ${err.message}</h2>`);
    }
});

app.post('/api/workers/gmail/fetch', async (req, res) => {
    try {
        const { userId, tokens } = req.body;
        if (!userId || !tokens) return res.status(400).json({ error: 'Missing userId or tokens' });
        const { fetchUnreadMessages } = await import('./workers/gmail.js');
        const results = await fetchUnreadMessages(tokens, userId);
        res.json({ success: true, processed: results.length, results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get real Telegram bot info (username, name)
let cachedBotInfo = null;
app.get('/api/telegram/bot-info', async (_req, res) => {
    try {
        if (!process.env.TELEGRAM_BOT_TOKEN) {
            return res.json({ configured: false });
        }
        if (cachedBotInfo) return res.json({ configured: true, ...cachedBotInfo });

        // Call Telegram getMe API directly
        const resp = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
        const data = await resp.json();
        if (data.ok) {
            cachedBotInfo = {
                username: data.result.username,
                firstName: data.result.first_name,
                botId: data.result.id,
            };
            return res.json({ configured: true, ...cachedBotInfo });
        }
        res.json({ configured: true, error: 'Invalid bot token' });
    } catch (err) {
        res.json({ configured: false, error: err.message });
    }
});

app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok', service: 'bmind-server',
        timestamp: new Date().toISOString(), version: '2.0.0',
        groq: !!process.env.GROQ_API_KEY,
        supabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
        tdlib: !!(process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH),
    });
});

// Start Telegram bot worker (safe — won't crash if token is invalid)
try {
    const { startTelegramWorker } = await import('./workers/telegram.js');
    startTelegramWorker();
} catch (err) {
    console.warn('[Telegram Bot] Worker failed to start:', err.message);
}

// Start TDLib if API credentials are configured
if (process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH) {
    try {
        const { initTdlib } = await import('./workers/tdlib-worker.js');
        initTdlib().catch(err => console.warn('[TDLib] Initialization skipped:', err.message));
    } catch (err) {
        console.warn('[TDLib] Module failed to load:', err.message);
    }
} else {
    console.info('[TDLib] Skipped — set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env to enable full Telegram access.');
}

app.listen(PORT, () => {
    console.log(`\n  🧠 Bmind running → http://localhost:${PORT}\n`);
});

export default app;
