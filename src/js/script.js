// ============================================
// BMIND — Landing Page Script v2
// Fixed auth + real platform connection flows
// ============================================

const API_BASE = 'http://localhost:3001';

// ============================================
// SESSION
// ============================================
const BmindSession = {
    save(data) { localStorage.setItem('bmind_session', JSON.stringify(data)); },
    get() { try { return JSON.parse(localStorage.getItem('bmind_session')); } catch { return null; } },
    clear() { localStorage.removeItem('bmind_session'); },
    getUserId() { return this.get()?.user?.id || null; },
    getToken() { return this.get()?.session?.accessToken || null; },
    isLoggedIn() { return !!this.getUserId(); }
};

// ============================================
// REDIRECT IF ALREADY LOGGED IN
// ============================================
if (BmindSession.isLoggedIn()) {
    // Already authenticated — skip landing, go to app
    // Only redirect if this is the landing page
    if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) {
        window.location.href = 'app.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {

    // ===========================
    // BACKGROUND CANVAS
    // ===========================
    const canvas = document.getElementById('antigravity-bg');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let width, height, centerX, centerY;
        const particles = [];
        const ripples = [];
        const particleCount = 70;
        const indigo = '#6366F1';
        const perspective = 1000;
        const maxZ = 2000;

        class Particle {
            constructor() { this.reset(); this.z = Math.random() * maxZ; }
            reset() {
                this.x = (Math.random() - 0.5) * 2500;
                this.y = (Math.random() - 0.5) * 2500;
                this.z = maxZ;
                this.type = Math.random() > 0.4 ? 'sphere' : 'fragment';
                this.size = Math.random() * (this.type === 'sphere' ? 5 : 4) + 2;
                this.vx = (Math.random() - 0.5) * 0.4;
                this.vy = (Math.random() - 0.5) * 0.4;
                this.vz = -(Math.random() * 1.5 + 0.5);
                this.rotation = Math.random() * Math.PI * 2;
                this.rotationSpeed = (Math.random() - 0.5) * 0.02;
            }
            update() {
                this.x += this.vx; this.y += this.vy; this.z += this.vz;
                this.rotation += this.rotationSpeed;
                if (this.z < -400) this.reset();
            }
            draw() {
                const scale = perspective / (this.z + perspective);
                const px = this.x * scale + centerX;
                const py = this.y * scale + centerY;
                const ps = this.size * scale;
                if (px < 0 || px > width || py < 0 || py > height || ps <= 0.1) return;
                const opacity = Math.min(1, Math.max(0, (this.z + 400) / (maxZ + 400)));
                const depthAlpha = (1 - opacity) * 0.8;
                ctx.save();
                ctx.translate(px, py);
                ctx.rotate(this.rotation);
                ctx.shadowBlur = 15 * scale;
                ctx.shadowColor = indigo;
                ctx.fillStyle = `rgba(99, 102, 241, ${depthAlpha * 0.6})`;
                if (this.type === 'sphere') {
                    ctx.beginPath(); ctx.arc(0, 0, ps, 0, Math.PI * 2); ctx.fill();
                } else {
                    ctx.beginPath(); ctx.moveTo(-ps, -ps); ctx.lineTo(ps, -ps);
                    ctx.lineTo(ps * 0.5, ps); ctx.closePath(); ctx.fill();
                }
                ctx.restore();
            }
        }

        class Ripple {
            constructor() { this.r = 0; this.opacity = 0.3; this.speed = 1.5; }
            update() { this.r += this.speed; this.opacity -= 0.001; if (this.opacity < 0) this.reset(); }
            reset() { this.r = 0; this.opacity = 0.3; }
            draw() {
                ctx.beginPath(); ctx.arc(centerX, centerY, this.r, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(99, 102, 241, ${this.opacity})`;
                ctx.lineWidth = 1; ctx.stroke();
            }
        }

        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            centerX = width / 2; centerY = height / 2;
        }
        window.addEventListener('resize', resize);
        resize();
        for (let i = 0; i < particleCount; i++) particles.push(new Particle());
        for (let i = 0; i < 4; i++) { const r = new Ripple(); r.r = i * (width / 5); ripples.push(r); }

        function animate() {
            ctx.clearRect(0, 0, width, height);
            ripples.forEach(r => { r.update(); r.draw(); });
            particles.sort((a, b) => b.z - a.z);
            particles.forEach((p, i) => {
                p.update(); p.draw();
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dz = Math.abs(p.z - p2.z);
                    if (dz > 300) continue;
                    const dx = p.x - p2.x, dy = p.y - p2.y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < 500) {
                        const scale1 = perspective / (p.z + perspective);
                        const scale2 = perspective / (p2.z + perspective);
                        const px1 = p.x * scale1 + centerX, py1 = p.y * scale1 + centerY;
                        const px2 = p2.x * scale2 + centerX, py2 = p2.y * scale2 + centerY;
                        const connAlpha = (1 - d / 500) * (1 - dz / 300) * (1 - p.z / maxZ) * 0.15;
                        if (connAlpha > 0) {
                            ctx.beginPath(); ctx.moveTo(px1, py1); ctx.lineTo(px2, py2);
                            ctx.strokeStyle = `rgba(99, 102, 241, ${connAlpha})`;
                            ctx.lineWidth = 0.5 * scale1; ctx.stroke();
                        }
                    }
                }
            });
            requestAnimationFrame(animate);
        }
        animate();
    }

    // ===========================
    // NAVBAR SCROLL
    // ===========================
    const navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 50));
    }

    // ===========================
    // SCROLL ANIMATIONS
    // ===========================
    const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) { entry.target.classList.add('visible'); fadeObserver.unobserve(entry.target); }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    document.querySelectorAll('.reveal').forEach(el => fadeObserver.observe(el));

    // ===========================
    // SMOOTH SCROLL
    // ===========================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            e.preventDefault();
            const target = document.querySelector(targetId);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // ===========================
    // AUTH MODAL LOGIC
    // ===========================
    const authModal = document.getElementById('auth-modal');
    const signupForm = document.getElementById('auth-signup-form');
    const loginForm = document.getElementById('auth-login-form');
    const errorSignup = document.getElementById('auth-error-signup');
    const errorLogin = document.getElementById('auth-error-login');

    document.getElementById('start-trial-btn')?.addEventListener('click', (e) => {
        e.preventDefault(); openAuthModal();
    });

    // "Get Early Access" in navbar
    document.querySelectorAll('.navbar-links .btn-primary').forEach(btn => {
        btn.addEventListener('click', (e) => { e.preventDefault(); openAuthModal(); });
    });

    function openAuthModal() {
        authModal?.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    function closeAuthModal() {
        authModal?.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Close on backdrop click
    authModal?.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
    });

    document.getElementById('switch-to-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        signupForm.classList.remove('active');
        loginForm.classList.add('active');
        if (errorSignup) errorSignup.textContent = '';
    });

    document.getElementById('switch-to-signup')?.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.remove('active');
        signupForm.classList.add('active');
        if (errorLogin) errorLogin.textContent = '';
    });

    // ---- SIGN UP ----
    signupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const btn = signupForm.querySelector('.auth-submit-btn');

        errorSignup.textContent = '';
        btn.disabled = true;
        btn.textContent = 'Creating account...';

        try {
            const res = await fetch(`${API_BASE}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, displayName: name }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Signup failed');

            BmindSession.save(data);
            closeAuthModal();
            showSetupScreen();

        } catch (err) {
            const msg = err instanceof TypeError
                ? '⚠️ Cannot reach server. Open the app via http://localhost:3001 (not as a file).'
                : err.message;
            errorSignup.textContent = msg;
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    });

    // ---- LOGIN ----
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const btn = loginForm.querySelector('.auth-submit-btn');

        errorLogin.textContent = '';
        btn.disabled = true;
        btn.textContent = 'Signing in...';

        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Login failed');
            }

            BmindSession.save(data);
            closeAuthModal();
            window.location.href = 'app.html';

        } catch (err) {
            const msg = err instanceof TypeError
                ? '⚠️ Cannot reach server. Open the app via http://localhost:3001 (not as a file).'
                : err.message;
            errorLogin.textContent = msg;
        } finally {
            btn.disabled = false;
            btn.textContent = 'Sign In';
        }
    });

    // ===========================
    // SETUP SCREEN
    // ===========================
    const setupScreen = document.getElementById('setup-screen');
    const finalizeActions = document.querySelector('.finalize-setup');

    function showSetupScreen() {
        if (setupScreen) {
            setupScreen.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    if (setupScreen) {
        const connectButtons = setupScreen.querySelectorAll('.connect-btn');
        let connectedCount = 0;

        connectButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const tile = btn.closest('.tactile-tile');
                const platform = tile.getAttribute('data-platform');
                const extractingContainer = tile.querySelector('.extracting-container');
                const progressFill = tile.querySelector('.setup-progress-fill');
                const successCheck = tile.querySelector('.success-check');

                btn.classList.add('loading');
                btn.textContent = 'Connecting...';

                try {
                    await connectPlatform(platform, btn, tile, extractingContainer, progressFill, successCheck);
                    connectedCount++;
                    if (connectedCount >= 1) finalizeActions.classList.add('visible');
                } catch (err) {
                    btn.classList.remove('loading');
                    btn.textContent = 'Retry';
                    btn.style.borderColor = '#f87171';
                    console.error(`[${platform}] Connection failed:`, err.message);
                }
            });
        });
    }

    async function connectPlatform(platform, btn, tile, extractingContainer, progressFill, successCheck) {
        const userId = BmindSession.getUserId();

        if (platform === 'gmail') {
            // Show real Gmail OAuth instructions
            showGmailInstructions(btn, tile, extractingContainer, progressFill, successCheck, userId);
            return;

        } else if (platform === 'telegram') {
            // Show real Telegram bot instructions
            showTelegramInstructions(btn, tile, extractingContainer, progressFill, successCheck, userId);
            return;

        } else {
            // WhatsApp / Slack — coming soon
            await simulateConnection(btn, extractingContainer, progressFill, successCheck, tile);
        }
    }

    // ===========================
    // GMAIL REAL CONNECTION FLOW
    // ===========================
    function showGmailInstructions(btn, tile, extractingContainer, progressFill, successCheck, userId) {
        btn.classList.remove('loading');
        btn.textContent = 'Connect';

        // Show instructions modal
        showInstructionModal({
            title: 'Connect Gmail',
            icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="#ea4335"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>`,
            steps: [
                { num: '1', text: 'Click <strong>Authorize Gmail</strong> below — a Google sign-in window will open.' },
                { num: '2', text: 'Sign in with your Google account and allow Bmind to read your Gmail.' },
                { num: '3', text: 'The window will close automatically once connected.' },
                { num: '4', text: 'Bmind will analyze your last 10 unread emails and extract tasks & deadlines.' },
            ],
            note: '🔒 Bmind only reads emails — it never sends, deletes, or modifies anything.',
            primaryLabel: 'Authorize Gmail',
            primaryAction: async () => {
                try {
                    // Try real OAuth first
                    const res = await fetch(`${API_BASE}/api/auth/connect/gmail`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId }),
                    });
                    const data = await res.json();

                    if (data.setupRequired) {
                        // Gmail not configured → show setup guide
                        showNotConfiguredModal('Gmail', [
                            'Go to <a href="https://console.cloud.google.com" target="_blank">console.cloud.google.com</a>',
                            'Create a new project (or select existing)',
                            'Enable <strong>Gmail API</strong> in APIs & Services',
                            'Go to Credentials → Create OAuth 2.0 Client ID (Web Application)',
                            'Add redirect URI: <code>http://localhost:3001/api/auth/gmail/callback</code>',
                            'Copy Client ID & Secret → paste into <code>server/.env</code>',
                            'Restart the server and try again',
                        ]);
                        return false;
                    }

                    if (data.authUrl) {
                        const popup = window.open(data.authUrl, 'gmail-auth', 'width=520,height=620,left=200,top=100');
                        await new Promise((resolve, reject) => {
                            const handler = (event) => {
                                if (event.data?.type === 'GMAIL_CONNECTED') {
                                    window.removeEventListener('message', handler);
                                    // Save tokens and fetch messages
                                    fetch(`${API_BASE}/api/workers/gmail/fetch`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ userId, tokens: event.data.tokens }),
                                    }).catch(console.error);
                                    resolve();
                                }
                            };
                            window.addEventListener('message', handler);
                            setTimeout(() => { window.removeEventListener('message', handler); reject(new Error('Timed out')); }, 120000);
                        });
                        return true;
                    }
                } catch (err) {
                    console.error('[Gmail] Connection error:', err);
                }
                return true;
            },
            onSuccess: () => simulateConnection(btn, extractingContainer, progressFill, successCheck, tile),
        });
    }

    // ===========================
    // TELEGRAM REAL CONNECTION FLOW
    // ===========================
    function showTelegramInstructions(btn, tile, extractingContainer, progressFill, successCheck, userId) {
        btn.classList.remove('loading');
        btn.textContent = 'Connect';

        showInstructionModal({
            title: 'Connect Telegram',
            icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="#2aabee"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>`,
            steps: [
                { num: '1', text: 'Open Telegram and search for <strong>@BotFather</strong>' },
                { num: '2', text: 'Send <code>/newbot</code> and follow the prompts to name your bot' },
                { num: '3', text: 'BotFather will give you a token like <code>123456:ABCdef...</code> — copy it' },
                { num: '4', text: 'Paste the token into <code>server/.env</code> as <code>TELEGRAM_BOT_TOKEN=...</code>' },
                { num: '5', text: 'Restart the server — your bot will now listen for messages' },
                { num: '6', text: 'Add your bot to Telegram groups or message it directly to start analysis' },
            ],
            note: '🤖 Your bot only reads messages in chats where you add it — it has no access to other chats.',
            primaryLabel: 'Mark as Connected',
            primaryAction: async () => {
                try {
                    await fetch(`${API_BASE}/api/auth/connect/telegram`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId }),
                    });
                    return true;
                } catch (err) {
                    console.error('[Telegram]', err);
                    return true;
                }
            },
            onSuccess: () => simulateConnection(btn, extractingContainer, progressFill, successCheck, tile),
        });
    }

    // ===========================
    // INSTRUCTION MODAL BUILDER
    // ===========================
    function showInstructionModal({ title, icon, steps, note, primaryLabel, primaryAction, onSuccess }) {
        // Remove existing modal if any
        document.getElementById('instruction-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'instruction-modal';
        modal.innerHTML = `
            <div class="instr-overlay"></div>
            <div class="instr-box">
                <button class="instr-close" aria-label="Close">✕</button>
                <div class="instr-header">
                    <div class="instr-icon">${icon}</div>
                    <h2 class="instr-title">${title}</h2>
                </div>
                <div class="instr-steps">
                    ${steps.map(s => `
                        <div class="instr-step">
                            <div class="instr-step-num">${s.num}</div>
                            <div class="instr-step-text">${s.text}</div>
                        </div>`).join('')}
                </div>
                <div class="instr-note">${note}</div>
                <div class="instr-actions">
                    <button class="instr-cancel btn-outline-sm">Cancel</button>
                    <button class="instr-primary btn-primary-sm">${primaryLabel}</button>
                </div>
            </div>
        `;

        // Styles
        const style = document.createElement('style');
        style.textContent = `
            #instruction-modal { position:fixed; inset:0; z-index:10000; display:flex; align-items:center; justify-content:center; }
            .instr-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(4px); }
            .instr-box { position:relative; background:#0f0f1a; border:1px solid rgba(99,102,241,0.3); border-radius:20px; padding:36px; max-width:480px; width:90%; z-index:1; box-shadow:0 24px 80px rgba(0,0,0,0.6); }
            .instr-close { position:absolute; top:16px; right:16px; background:none; border:none; color:#94a3b8; cursor:pointer; font-size:18px; padding:4px 8px; border-radius:6px; transition:color .2s; }
            .instr-close:hover { color:#fff; }
            .instr-header { display:flex; align-items:center; gap:14px; margin-bottom:24px; }
            .instr-icon { flex-shrink:0; }
            .instr-title { font-size:1.4rem; font-weight:700; color:#fff; margin:0; }
            .instr-steps { display:flex; flex-direction:column; gap:14px; margin-bottom:20px; }
            .instr-step { display:flex; align-items:flex-start; gap:12px; }
            .instr-step-num { width:26px; height:26px; border-radius:50%; background:rgba(99,102,241,0.2); border:1px solid rgba(99,102,241,0.4); color:#a5b4fc; font-size:0.78rem; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
            .instr-step-text { color:#cbd5e1; font-size:0.9rem; line-height:1.6; }
            .instr-step-text strong { color:#e2e8f0; }
            .instr-step-text code { background:rgba(99,102,241,0.15); color:#a5b4fc; padding:1px 6px; border-radius:4px; font-family:monospace; font-size:0.85em; }
            .instr-step-text a { color:#818cf8; }
            .instr-note { background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.2); border-radius:10px; padding:12px 14px; color:#94a3b8; font-size:0.83rem; margin-bottom:24px; line-height:1.5; }
            .instr-actions { display:flex; gap:12px; justify-content:flex-end; }
            .btn-outline-sm { background:none; border:1px solid rgba(255,255,255,0.15); color:#94a3b8; padding:10px 20px; border-radius:8px; cursor:pointer; font-size:0.88rem; transition:all .2s; }
            .btn-outline-sm:hover { border-color:rgba(255,255,255,0.3); color:#fff; }
            .btn-primary-sm { background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; border:none; padding:10px 22px; border-radius:8px; cursor:pointer; font-size:0.88rem; font-weight:600; transition:opacity .2s; }
            .btn-primary-sm:hover { opacity:0.85; }
            .btn-primary-sm:disabled { opacity:0.5; cursor:not-allowed; }
        `;
        document.head.appendChild(style);
        document.body.appendChild(modal);

        const closeModal = () => { modal.remove(); style.remove(); };

        modal.querySelector('.instr-close').addEventListener('click', closeModal);
        modal.querySelector('.instr-cancel').addEventListener('click', closeModal);
        modal.querySelector('.instr-overlay').addEventListener('click', closeModal);

        modal.querySelector('.instr-primary').addEventListener('click', async () => {
            const btn = modal.querySelector('.instr-primary');
            btn.disabled = true;
            btn.textContent = 'Connecting...';
            try {
                const success = await primaryAction();
                if (success !== false) {
                    closeModal();
                    if (onSuccess) await onSuccess();
                }
            } catch (err) {
                btn.disabled = false;
                btn.textContent = primaryLabel;
                console.error(err);
            }
        });
    }

    function showNotConfiguredModal(platform, instructions) {
        showInstructionModal({
            title: `Set Up ${platform} Integration`,
            icon: `<div style="font-size:32px">⚙️</div>`,
            steps: instructions.map((text, i) => ({ num: String(i + 1), text })),
            note: `After setup, restart the server and try connecting again.`,
            primaryLabel: 'Got it',
            primaryAction: async () => true,
            onSuccess: null,
        });
    }

    function simulateConnection(btn, extractingContainer, progressFill, successCheck, tile) {
        return new Promise((resolve) => {
            btn.style.display = 'none';
            extractingContainer.style.display = 'flex';
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                    setTimeout(() => {
                        extractingContainer.style.display = 'none';
                        successCheck.style.display = 'flex';
                        tile.classList.add('connected');
                        resolve();
                    }, 500);
                }
                progressFill.style.width = progress + '%';
            }, 150);
        });
    }

    // ===========================
    // FEATURE CARD PARALLAX
    // ===========================
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
            const y = ((e.clientY - rect.top) / rect.height - 0.5) * -20;
            card.style.transform = `perspective(800px) rotateX(${y}deg) rotateY(${x}deg) translateY(-10px)`;
        });
        card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });

    // ===========================
    // TIME SLIDER
    // ===========================
    const slider = document.getElementById('time-slider');
    const sliderVal = document.getElementById('slider-value');
    if (slider && sliderVal) {
        slider.addEventListener('input', (e) => {
            sliderVal.textContent = e.target.value === '1' ? '24 hours' : `${e.target.value} days`;
        });
    }
});
