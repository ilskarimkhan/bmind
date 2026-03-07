// ============================================
// BMIND SPA — Unified Application Script
// Consolidates dashboard.js, archive.js, connections.js
// ============================================

document.addEventListener('DOMContentLoaded', () => {

    // =============================================
    // DASHBOARD (PULSE) LOGIC
    // =============================================

    // --- Dynamic Greeting Based on Time ---
    const heroGreetingDynamic = document.getElementById('hero-greeting-dynamic');
    if (heroGreetingDynamic) {
        const hour = new Date().getHours();
        let greeting = 'Good morning';
        if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
        else if (hour >= 17) greeting = 'Good evening';
        heroGreetingDynamic.innerHTML = `${greeting}, Alex. Bmind is analyzing <span class="highlight-sources">4 new sources</span>.`;
    }

    // --- Entrance Animations for Pulse ---
    const animateElements = [
        { el: document.getElementById('priority-card'), delay: 0 },
        { el: document.getElementById('timeline-rail'), delay: 150 },
        { el: document.getElementById('actions-panel'), delay: 300 },
        { el: document.getElementById('mastery-panel'), delay: 400 },
    ];

    animateElements.forEach(({ el, delay }) => {
        if (el) {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            setTimeout(() => {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, delay);
        }
    });

    // --- Deadline Rail horizontal scroll with mouse wheel ---
    const railScroll = document.querySelector('.timeline-track-container');
    if (railScroll) {
        railScroll.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                railScroll.scrollLeft += e.deltaY;
            }
        }, { passive: false });
    }

    // --- Bmind Context Widget Toggle ---
    const contextWidget = document.getElementById('contextWidget');
    const neuralTrigger = document.getElementById('neuralTrigger');

    if (contextWidget && neuralTrigger) {
        neuralTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            contextWidget.classList.toggle('expanded');
        });

        document.addEventListener('click', (e) => {
            if (contextWidget.classList.contains('expanded') && !contextWidget.contains(e.target)) {
                contextWidget.classList.remove('expanded');
            }
        });

        contextWidget.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // =============================================
    // ARCHIVE LOGIC
    // =============================================

    const inspectorPanel = document.getElementById('inspector-panel');
    const inspectorOverlay = document.getElementById('inspector-overlay');
    const btnCloseInspector = document.getElementById('btn-close-inspector');
    const inspectTask = document.getElementById('inspect-task');
    const snippetApp = document.querySelector('.snippet-app');
    const snippetSender = document.querySelector('.snippet-sender');
    const snippetBody = document.querySelector('.snippet-body');

    const originData = {
        't-1': { task: 'Finalize Biology Paper.', app: 'Gmail', appColor: 'rgba(234, 67, 53, 0.8)', sender: 'From: Prof. Chen', body: '"Hello everyone, just a reminder that the final draft of your Biology Paper is due this Friday by 5:00 PM."' },
        't-2': { task: 'Review Mitosis Chapter 4-6', app: 'Telegram', appColor: 'rgba(0, 136, 204, 0.8)', sender: 'From: Study Group', body: '"Are we still meeting at the library? We really need to go over the mitosis stages."' },
        't-3': { task: 'Send outline to Sarah', app: 'WhatsApp', appColor: 'rgba(37, 211, 102, 0.8)', sender: 'From: Group Project', body: '"Hey Rinat, could you send your part of the outline to Sarah by EOD?"' },
        'tr-1': { task: 'Biology Paper Final', app: 'Gmail', appColor: 'rgba(234, 67, 53, 0.8)', sender: 'From: Dropbox', body: '"Your file Biology_Final_Draft_v3.pdf was successfully uploaded."' },
        'tr-2': { task: 'Sprint Presentation', app: 'Slack', appColor: 'rgba(224, 30, 90, 0.8)', sender: 'From: Design Team', body: '"Great presentation today. Let\'s create the tickets for the next sprint."' },
        'tr-3': { task: 'Read Ch. 4 & 5', app: 'Bmind Logic', appColor: 'var(--electric-indigo)', sender: 'From: System Insight', body: 'Focus Session Completed (90m). "You maintained a 95% deep focus score."' }
    };

    function openInspector(originId) {
        if (!inspectorPanel || !inspectorOverlay) return;
        const data = originData[originId];
        if (data) {
            if (inspectTask) inspectTask.textContent = data.task;
            if (snippetApp) { snippetApp.textContent = data.app; snippetApp.style.color = data.appColor; }
            if (snippetSender) snippetSender.textContent = data.sender;
            if (snippetBody) snippetBody.textContent = data.body;
        }
        inspectorOverlay.classList.add('active');
        inspectorPanel.classList.add('active');
    }

    function closeInspector() {
        if (!inspectorPanel || !inspectorOverlay) return;
        inspectorOverlay.classList.remove('active');
        inspectorPanel.classList.remove('active');
    }

    const archiveCards = document.querySelectorAll('.ghost-card, .trophy-card');
    archiveCards.forEach(card => {
        card.addEventListener('click', () => {
            const originId = card.getAttribute('data-origin-id');
            openInspector(originId);
        });
    });

    if (btnCloseInspector) btnCloseInspector.addEventListener('click', closeInspector);
    if (inspectorOverlay) inspectorOverlay.addEventListener('click', closeInspector);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeInspector();
            closeConnectionsPanel();
        }
    });

    // =============================================
    // CONNECTIONS LOGIC
    // =============================================

    // --- 3D Tilt Effect on Tiles ---
    const tiles = document.querySelectorAll('.integration-tile');

    tiles.forEach(tile => {
        tile.addEventListener('mousemove', (e) => {
            const rect = tile.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -10;
            const rotateY = ((x - centerX) / centerX) * 10;
            tile.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        });
        tile.addEventListener('mouseleave', () => {
            tile.style.transform = `perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)`;
        });
    });

    // --- Side Panel Logic ---
    const panel = document.getElementById('config-panel');
    const backdrop = document.getElementById('overlay-backdrop');
    const closeBtn = document.getElementById('close-panel-btn');
    const panelTitle = document.getElementById('panel-title');
    const panelIconContainer = document.getElementById('panel-icon');

    const serviceData = {
        whatsapp: { title: 'WhatsApp Config', svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>`, color: 'var(--whatsapp)' },
        telegram: { title: 'Telegram Config', svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0z"/></svg>`, color: 'var(--telegram)' },
        gmail: { title: 'Gmail Config', svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>`, color: 'var(--gmail)' },
        slack: { title: 'Slack Config', svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z"/></svg>`, color: 'var(--slack)' }
    };

    function openConnectionsPanel(serviceKey) {
        const data = serviceData[serviceKey];
        if (data && panelTitle && panelIconContainer) {
            panelTitle.textContent = data.title;
            panelIconContainer.innerHTML = data.svg;
            panelIconContainer.style.color = data.color;
        }
        if (panel) panel.classList.add('active');
        if (backdrop) backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeConnectionsPanel() {
        if (panel) panel.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }

    tiles.forEach(tile => {
        tile.addEventListener('click', () => {
            const service = tile.getAttribute('data-service');
            openConnectionsPanel(service);
        });
    });

    if (closeBtn) closeBtn.addEventListener('click', closeConnectionsPanel);
    if (backdrop) backdrop.addEventListener('click', closeConnectionsPanel);

    // --- Temporal Slider ---
    const slider = document.getElementById('temporal-slider');
    const sliderValueDisplay = document.getElementById('temporal-value');

    if (slider && sliderValueDisplay) {
        slider.addEventListener('input', (e) => {
            const val = e.target.value;
            let label = `${val} days`;
            if (val === '1') label = '24 hours';
            sliderValueDisplay.textContent = label;
        });
    }

    // --- Reveal Animations ---
    const revealElements = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => { entry.target.classList.add('visible'); }, index * 100);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
    revealElements.forEach(el => revealObserver.observe(el));

});
