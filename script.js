// ============================================
// BMIND — Landing Page Script
// Handles animations, auth, and setup flow
// ============================================

const API_BASE = 'http://localhost:3001';

// ============================================
// SESSION MANAGEMENT
// ============================================
const BmindSession = {
    save(data) {
        localStorage.setItem('bmind_session', JSON.stringify(data));
    },
    get() {
        try {
            return JSON.parse(localStorage.getItem('bmind_session'));
        } catch { return null; }
    },
    clear() {
        localStorage.removeItem('bmind_session');
    },
    getUserId() {
        return this.get()?.user?.id || null;
    },
    getToken() {
        return this.get()?.session?.accessToken || null;
    }
};

document.addEventListener('DOMContentLoaded', () => {

    // ===========================
    // BACKGROUND CANVAS
    // ===========================
    const canvas = document.getElementById('antigravity-bg');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let w, h, particles = [];

        function resize() {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        class Particle {
            constructor() { this.reset(); }
            reset() {
                this.x = Math.random() * w;
                this.y = Math.random() * h;
                this.radius = Math.random() * 1.5 + 0.3;
                this.vx = (Math.random() - 0.5) * 0.15;
                this.vy = (Math.random() - 0.5) * 0.15;
                this.alpha = Math.random() * 0.4 + 0.1;
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
                if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) this.reset();
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(99, 102, 241, ${this.alpha})`;
                ctx.fill();
            }
        }

        for (let i = 0; i < 80; i++) particles.push(new Particle());

        function animate() {
            ctx.clearRect(0, 0, w, h);
            particles.forEach(p => { p.update(); p.draw(); });
            requestAnimationFrame(animate);
        }
        animate();
    }

    // ===========================
    // NAVBAR SCROLL EFFECT
    // ===========================
    const navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        });
    }

    // ===========================
    // SCROLL ANIMATIONS
    // ===========================
    const observerOptions = { threshold: 0.15, rootMargin: '0px 0px -60px 0px' };
    const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                fadeObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.feature-card, .step-card, .privacy-cell, .cta-section, .footer-section').forEach(el => {
        fadeObserver.observe(el);
    });

    // ===========================
    // SMOOTH SCROLL
    // ===========================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            e.preventDefault();
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // ===========================
    // AUTH MODAL LOGIC
    // ===========================
    const authModal = document.getElementById('auth-modal');
    const signupForm = document.getElementById('auth-signup-form');
    const loginForm = document.getElementById('auth-login-form');
    const switchToLogin = document.getElementById('switch-to-login');
    const switchToSignup = document.getElementById('switch-to-signup');
    const errorSignup = document.getElementById('auth-error-signup');
    const errorLogin = document.getElementById('auth-error-login');

    // "Get Early Access" / "Start Free Trial" opens auth modal
    const startTrialBtn = document.getElementById('start-trial-btn');
    const getEarlyAccessBtns = document.querySelectorAll('.btn.btn-primary');

    if (startTrialBtn) {
        startTrialBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openAuthModal();
        });
    }

    function openAuthModal() {
        if (authModal) authModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeAuthModal() {
        if (authModal) authModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Switch between forms
    if (switchToLogin) {
        switchToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            signupForm.classList.remove('active');
            loginForm.classList.add('active');
            if (errorSignup) errorSignup.textContent = '';
        });
    }

    if (switchToSignup) {
        switchToSignup.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.remove('active');
            signupForm.classList.add('active');
            if (errorLogin) errorLogin.textContent = '';
        });
    }

    // ---- SIGN UP ----
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
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

                if (!res.ok) {
                    throw new Error(data.error || 'Signup failed');
                }

                // Save session
                BmindSession.save(data);
                closeAuthModal();
                showSetupScreen();

            } catch (err) {
                errorSignup.textContent = err.message;
            } finally {
                btn.disabled = false;
                btn.textContent = 'Create Account';
            }
        });
    }

    // ---- LOGIN ----
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
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

                if (!res.ok) {
                    throw new Error(data.error || 'Login failed');
                }

                // Save session
                BmindSession.save(data);
                closeAuthModal();

                // Go directly to the app if already set up
                window.location.href = 'app.html';

            } catch (err) {
                errorLogin.textContent = err.message;
            } finally {
                btn.disabled = false;
                btn.textContent = 'Sign In';
            }
        });
    }

    // ===========================
    // SETUP SCREEN LOGIC
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

                // Start Loading
                btn.classList.add('loading');
                btn.textContent = 'Connecting...';

                try {
                    // Call the real backend
                    await connectPlatform(platform, btn, tile, extractingContainer, progressFill, successCheck);

                    connectedCount++;
                    if (connectedCount >= 1) {
                        finalizeActions.classList.add('visible');
                    }
                } catch (err) {
                    btn.classList.remove('loading');
                    btn.textContent = 'Retry';
                    btn.style.borderColor = '#f87171';
                    console.error(`[${platform}] Connection failed:`, err.message);
                }
            });
        });
    }

    /**
     * Connect a platform via the server API.
     */
    async function connectPlatform(platform, btn, tile, extractingContainer, progressFill, successCheck) {
        const userId = BmindSession.getUserId();

        if (platform === 'gmail') {
            // Gmail: Start OAuth flow
            const res = await fetch(`${API_BASE}/api/auth/connect/gmail`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            const data = await res.json();

            if (data.setupRequired) {
                // Gmail OAuth not configured yet — simulate success for now
                console.warn('[Gmail] OAuth not configured. Set GMAIL_CLIENT_ID in server/.env');
                await simulateConnection(btn, extractingContainer, progressFill, successCheck, tile);
                return;
            }

            if (data.authUrl) {
                // Open Google OAuth in a popup
                const popup = window.open(data.authUrl, 'gmail-auth', 'width=500,height=600');

                // Listen for completion message from popup
                await new Promise((resolve, reject) => {
                    const handler = (event) => {
                        if (event.data?.type === 'GMAIL_CONNECTED') {
                            window.removeEventListener('message', handler);
                            resolve(event.data.tokens);
                        }
                    };
                    window.addEventListener('message', handler);

                    // Timeout after 2 minutes
                    setTimeout(() => {
                        window.removeEventListener('message', handler);
                        if (popup && !popup.closed) popup.close();
                        reject(new Error('Gmail auth timed out'));
                    }, 120000);
                });

                await simulateConnection(btn, extractingContainer, progressFill, successCheck, tile);
                return;
            }

        } else if (platform === 'telegram') {
            // Telegram: Connect via bot
            const res = await fetch(`${API_BASE}/api/auth/connect/telegram`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, telegramUsername: '' }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            await simulateConnection(btn, extractingContainer, progressFill, successCheck, tile);
            return;

        } else {
            // WhatsApp / Slack: Mark as connected (placeholder for now)
            await simulateConnection(btn, extractingContainer, progressFill, successCheck, tile);
        }
    }

    /**
     * Animate the connection progress bar and show success.
     */
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
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });

});
