// ============================================
// AUTH API
// POST /api/auth/signup   — Create account (Supabase Auth)
// POST /api/auth/login    — Sign in (Supabase Auth)
// GET  /api/auth/me       — Get current user
// POST /api/auth/connect/telegram — Link Telegram account
// ============================================

import { Router } from 'express';
import { supabase, supabaseAdmin } from '../lib/supabase.js';

const router = Router();

/**
 * POST /api/auth/signup
 * Body: { email, password, displayName }
 */
router.post('/signup', async (req, res) => {
    try {
        const { email, password, displayName } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // --- FIX: Use Admin API to create user to bypass email rate limits & verification ---
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { display_name: displayName || email.split('@')[0] }
        });

        if (error) {
            console.error('[Auth] Signup Admin error:', error.message);
            return res.status(400).json({ error: error.message });
        }

        // Also insert into our custom users table
        if (data.user) {
            await supabaseAdmin.from('users').upsert({
                id: data.user.id,
                email: data.user.email,
                display_name: displayName || email.split('@')[0],
            });
        }

        // --- FIX: Immediately sign in to get the missing session ---
        let finalSession = data.session;
        if (!finalSession) {
             const signInRes = await supabase.auth.signInWithPassword({ email, password });
             if (signInRes.data?.session) {
                 finalSession = signInRes.data.session;
             }
        }

        res.json({
            success: true,
            user: {
                id: data.user?.id,
                email: data.user?.email,
                displayName: displayName || email.split('@')[0],
            },
            session: {
                accessToken: finalSession?.access_token,
                refreshToken: finalSession?.refresh_token,
                expiresAt: finalSession?.expires_at,
            },
        });

    } catch (error) {
        console.error('[Auth] Signup error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return res.status(401).json({ error: error.message });
        }

        res.json({
            success: true,
            user: {
                id: data.user?.id,
                email: data.user?.email,
                displayName: data.user?.user_metadata?.display_name,
            },
            session: {
                accessToken: data.session?.access_token,
                refreshToken: data.session?.refresh_token,
                expiresAt: data.session?.expires_at,
            },
        });

    } catch (error) {
        console.error('[Auth] Login error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <access_token>
 */
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Fetch connection status from our users table
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.user_metadata?.display_name,
                connections: {
                    gmail: profile?.gmail_connected || false,
                    telegram: profile?.telegram_connected || false,
                    whatsapp: profile?.whatsapp_connected || false,
                    slack: profile?.slack_connected || false,
                },
            },
        });

    } catch (error) {
        console.error('[Auth] Me error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/auth/connect/telegram
 * Body: { userId, telegramUsername }
 * Marks Telegram as connected for the user
 */
router.post('/connect/telegram', async (req, res) => {
    try {
        const { userId, telegramUsername } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        // Remove '@' if user included it
        const cleanUsername = telegramUsername.replace(/^@/, '').trim();

        const { error } = await supabaseAdmin
            .from('users')
            .update({ 
                telegram_connected: true,
                telegram_username: cleanUsername 
            })
            .eq('id', userId);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Get real bot name to show in the success message
        let botName = '@BmindAssistBot';
        try {
            const botRes = await fetch('http://localhost:3001/api/telegram/bot-info');
            const botData = await botRes.json();
            if (botData.configured && botData.username) botName = `@${botData.username}`;
        } catch(e) {}

        res.json({
            success: true,
            message: `Telegram connected! Add our bot ${botName} to your groups to start receiving intelligence.`,
            telegramUsername: cleanUsername,
        });

    } catch (error) {
        console.error('[Auth] Connect Telegram error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/auth/connect/gmail
 * Starts the Gmail OAuth flow → returns the auth URL
 */
router.post('/connect/gmail', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        // Check if Gmail OAuth is configured
        if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
            return res.status(503).json({
                error: 'Gmail OAuth not configured yet',
                message: 'Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in server/.env to enable Gmail connection.',
                setupRequired: true,
            });
        }

        // Import dynamically to avoid crash if not configured
        const { getAuthUrl } = await import('../workers/gmail.js');
        const authUrl = getAuthUrl();

        res.json({
            success: true,
            authUrl,
            message: 'Redirect the user to authUrl to complete Gmail authorization.',
        });

    } catch (error) {
        console.error('[Auth] Connect Gmail error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/auth/disconnect/:platform
 * Body: { userId }
 * Marks a platform as disconnected for the user
 */
router.post('/disconnect/:platform', async (req, res) => {
    try {
        const { platform } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const validPlatforms = ['gmail', 'telegram', 'whatsapp', 'slack'];
        if (!validPlatforms.includes(platform)) {
            return res.status(400).json({ error: `Invalid platform: ${platform}` });
        }

        const { error } = await supabaseAdmin
            .from('users')
            .update({ [`${platform}_connected`]: false })
            .eq('id', userId);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, message: `${platform} disconnected.` });

    } catch (error) {
        console.error(`[Auth] Disconnect ${req.params.platform} error:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

export default router;
