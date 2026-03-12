// ============================================
// TDLIB AUTH API
// POST /api/tdlib/send-code — sends OTP
// POST /api/tdlib/verify-code — verifies OTP
// GET  /api/tdlib/status — check if TDLib is ready
// ============================================

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

let tdlibInitialized = false;
let workerModule = null;

async function getWorker() {
    if (!workerModule) {
        workerModule = await import('../workers/tdlib-worker.js');
    }
    return workerModule;
}

// Config guard — return helpful error if TDLib not configured
function checkTdlibConfig(res) {
    if (!process.env.TELEGRAM_API_ID || !process.env.TELEGRAM_API_HASH) {
        res.status(503).json({
            error: 'TDLib not configured',
            message: 'Telegram full access is not available right now. Please try again later.',
            setupRequired: true,
        });
        return false;
    }
    return true;
}

/**
 * POST /api/tdlib/send-code
 * Body: { phoneNumber, userId }
 */
router.post('/send-code', async (req, res) => {
    if (!checkTdlibConfig(res)) return;

    try {
        const { phoneNumber, userId } = req.body;
        if (!phoneNumber) return res.status(400).json({ error: 'Missing phoneNumber' });

        const worker = await getWorker();

        // Init TDLib if not yet done
        if (!tdlibInitialized) {
            await worker.initTdlib();
            tdlibInitialized = true;
        }

        // Pre-associate the user so historical sync fires with the right userId
        if (userId) {
            worker.setCurrentUser(userId);
            // Store phone for reference
            await supabaseAdmin.from('users')
                .update({ tdlib_phone: phoneNumber })
                .eq('id', userId);
        }

        const result = await worker.sendAuthCode(phoneNumber);
        res.json(result);
    } catch (err) {
        console.error('[TDLib Auth] Send code error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/tdlib/verify-code
 * Body: { code, userId }
 */
router.post('/verify-code', async (req, res) => {
    if (!checkTdlibConfig(res)) return;

    try {
        const { code, userId } = req.body;
        if (!code) return res.status(400).json({ error: 'Missing code' });

        const worker = await getWorker();

        // Ensure userId is set before verification (so auth-ready event assigns it)
        if (userId) {
            worker.setCurrentUser(userId);
        }

        const result = await worker.verifyAuthCode(code);

        // Mark user as TDLib-connected in DB
        if (userId) {
            await supabaseAdmin.from('users')
                .update({ tdlib_connected: true, telegram_connected: true })
                .eq('id', userId);
        }

        res.json({
            ...result,
            syncing: true,
            message: 'Connected! Syncing your Telegram history in the background…',
        });
    } catch (err) {
        console.error('[TDLib Auth] Verify code error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/tdlib/status
 */
router.get('/status', async (_req, res) => {
    try {
        if (!process.env.TELEGRAM_API_ID) {
            return res.json({ ready: false, configured: false });
        }
        const worker = await getWorker();
        res.json({ ready: worker.isTdlibReady(), initialized: tdlibInitialized, configured: true });
    } catch {
        res.json({ ready: false, initialized: false, configured: true });
    }
});

export default router;
