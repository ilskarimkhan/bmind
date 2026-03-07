// ============================================
// BMIND — Script
// ============================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 3D Antigravity Background ---
    const canvas = document.getElementById('antigravity-bg');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let width, height, centerX, centerY;
        const particles = [];
        const ripples = [];
        const particleCount = 70;
        const indigo = '#6366F1';

        // 3D Projection Config
        const perspective = 1000;
        const maxZ = 2000;

        class Particle {
            constructor() {
                this.reset();
                this.z = Math.random() * maxZ; // Initial random depth
            }

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
                this.x += this.vx;
                this.y += this.vy;
                this.z += this.vz;
                this.rotation += this.rotationSpeed;

                if (this.z < -400) this.reset();
            }

            draw() {
                const scale = perspective / (this.z + perspective);
                const px = this.x * scale + centerX;
                const py = this.y * scale + centerY;
                const ps = this.size * scale;

                if (px < 0 || px > width || py < 0 || py > height || ps <= 0.1) return;

                // Depth-based opacity and blur
                const opacity = Math.min(1, Math.max(0, (this.z + 400) / (maxZ + 400)));
                const depthAlpha = (1 - opacity) * 0.8;

                ctx.save();
                ctx.translate(px, py);
                ctx.rotate(this.rotation);

                ctx.shadowBlur = 15 * scale;
                ctx.shadowColor = indigo;
                ctx.fillStyle = `rgba(99, 102, 241, ${depthAlpha * 0.6})`;

                if (this.type === 'sphere') {
                    ctx.beginPath();
                    ctx.arc(0, 0, ps, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Fragment (polygon)
                    ctx.beginPath();
                    ctx.moveTo(-ps, -ps);
                    ctx.lineTo(ps, -ps);
                    ctx.lineTo(ps * 0.5, ps);
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
            }
        }

        class Ripple {
            constructor() {
                this.r = 0;
                this.opacity = 0.3;
                this.speed = 1.5;
            }
            update() {
                this.r += this.speed;
                this.opacity -= 0.001;
                if (this.opacity < 0) this.reset();
            }
            reset() {
                this.r = 0;
                this.opacity = 0.3;
            }
            draw() {
                ctx.beginPath();
                ctx.arc(centerX, centerY, this.r, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(99, 102, 241, ${this.opacity})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            centerX = width / 2;
            centerY = height / 2;
        }

        window.addEventListener('resize', resize);
        resize();

        // Initial Spawn
        for (let i = 0; i < particleCount; i++) particles.push(new Particle());
        for (let i = 0; i < 4; i++) {
            const r = new Ripple();
            r.r = i * (width / 5);
            ripples.push(r);
        }

        function animate() {
            ctx.clearRect(0, 0, width, height);

            // Draw Ripples (Background layer)
            ripples.forEach(r => {
                r.update();
                r.draw();
            });

            // Update and Draw Particles with Connections
            particles.sort((a, b) => b.z - a.z); // Sort by depth for correct layering

            particles.forEach((p, i) => {
                p.update();
                p.draw();

                // Connections
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dz = Math.abs(p.z - p2.z);
                    if (dz > 300) continue;

                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const d = Math.sqrt(dx * dx + dy * dy);

                    if (d < 500) {
                        const scale1 = perspective / (p.z + perspective);
                        const scale2 = perspective / (p2.z + perspective);

                        const px1 = p.x * scale1 + centerX;
                        const py1 = p.y * scale1 + centerY;
                        const px2 = p2.x * scale2 + centerX;
                        const py2 = p2.y * scale2 + centerY;

                        const connAlpha = (1 - d / 500) * (1 - dz / 300) * (1 - p.z / maxZ) * 0.15;
                        if (connAlpha > 0) {
                            ctx.beginPath();
                            ctx.moveTo(px1, py1);
                            ctx.lineTo(px2, px2 > px1 ? px2 : px2); // Draw to p2
                            ctx.lineTo(px2, py2);
                            ctx.strokeStyle = `rgba(99, 102, 241, ${connAlpha})`;
                            ctx.lineWidth = 0.5 * scale1;
                            ctx.stroke();
                        }
                    }
                }
            });

            requestAnimationFrame(animate);
        }
        animate();
    }

    // --- Scroll Reveal ---
    const revealElements = document.querySelectorAll('.reveal');

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, index * 80);
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach((el) => revealObserver.observe(el));

    // --- Navbar Scroll Effect ---
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // --- Time Slider ---
    const slider = document.getElementById('time-slider');
    const sliderValue = document.getElementById('slider-value');

    if (slider && sliderValue) {
        slider.addEventListener('input', () => {
            const val = parseInt(slider.value);
            if (val === 1) {
                sliderValue.textContent = '1 day';
            } else if (val <= 30) {
                sliderValue.textContent = val + ' days';
            } else if (val <= 60) {
                sliderValue.textContent = Math.round(val / 7) + ' weeks';
            } else {
                sliderValue.textContent = Math.round(val / 30) + ' months';
            }
        });
    }

    // --- Smooth Scroll for Nav Links ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            e.preventDefault();
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // --- SETUP SCREEN LOGIC ---
    const setupScreen = document.getElementById('setup-screen');
    const startTrialBtn = document.getElementById('start-trial-btn');
    const finishSetupBtn = document.getElementById('finish-setup');
    const finalizeActions = document.querySelector('.finalize-setup');

    if (startTrialBtn && setupScreen) {
        startTrialBtn.addEventListener('click', (e) => {
            e.preventDefault();
            setupScreen.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        });
    }

    if (setupScreen) {
        const connectButtons = setupScreen.querySelectorAll('.connect-btn');
        let connectedCount = 0;

        connectButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tile = btn.closest('.tactile-tile');
                const extractingContainer = tile.querySelector('.extracting-container');
                const progressFill = tile.querySelector('.setup-progress-fill');
                const successCheck = tile.querySelector('.success-check');

                // Start Loading State
                btn.classList.add('loading');
                btn.textContent = 'Connecting...';

                // Show Extraction Progress
                setTimeout(() => {
                    btn.style.display = 'none';
                    extractingContainer.style.display = 'flex';

                    let progress = 0;
                    const interval = setInterval(() => {
                        progress += Math.random() * 15;
                        if (progress >= 100) {
                            progress = 100;
                            clearInterval(interval);

                            // Success State
                            setTimeout(() => {
                                extractingContainer.style.display = 'none';
                                successCheck.style.display = 'flex';
                                tile.classList.add('connected');

                                connectedCount++;
                                if (connectedCount >= 1) {
                                    finalizeActions.classList.add('visible');
                                }
                            }, 500);
                        }
                        progressFill.style.width = progress + '%';
                    }, 150);
                }, 600);
            });
        });
    }

    // Listener for finishSetupBtn removed as it's an anchor tag.

});
