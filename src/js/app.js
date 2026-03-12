// ============================================
// BMIND SPA — Unified Application Script
// Consolidates dashboard.js, archive.js, connections.js
// ============================================

const API_BASE = 'http://localhost:3001';

const SOURCE_META = {
    whatsapp: { label: 'WhatsApp', abbr: 'WA', color: '#25D366' },
    telegram: { label: 'Telegram', abbr: 'TG', color: '#0088cc' },
    gmail: { label: 'Gmail', abbr: 'GM', color: '#ea4335' },
    slack: { label: 'Slack', abbr: 'SL', color: '#e01e5a' },
    manual: { label: 'Bmind Logic', abbr: 'BM', color: '#6366f1' },
    unknown: { label: 'System', abbr: 'SYS', color: '#94a3b8' }
};

const BmindSession = {
    get() { try { return JSON.parse(localStorage.getItem('bmind_session')); } catch { return null; } },
    getUserId() { return this.get()?.user?.id || null; },
    getToken() { return this.get()?.session?.accessToken || null; },
    clear() { localStorage.removeItem('bmind_session'); },
};

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

    const originData = {};

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

    // --- Timeline Rail Controls ---
    window.timelineMode = 7;
    document.querySelectorAll('.rail-mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.rail-mode-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = 'var(--soft-silver)';
            });
            const target = e.target;
            target.classList.add('active');
            target.style.background = 'rgba(255,255,255,0.1)';
            target.style.color = 'var(--white)';
            window.timelineMode = parseInt(target.getAttribute('data-mode'), 10);
            
            if (window.currentTasks) {
                renderTimeline(window.currentTasks);
            }
        });
    });

    // --- Full Calendar Modal ---
    const calendarModal = document.getElementById('calendar-modal');
    const btnCloseCalendar = document.getElementById('btn-close-calendar');
    const btnOpenCalendar = document.querySelector('.btn-full-calendar');

    btnOpenCalendar?.addEventListener('click', () => {
        if (calendarModal) {
            calendarModal.classList.add('active');
            if (typeof renderFullCalendar === 'function') {
                renderFullCalendar(window.currentTasks || []);
            }
        }
    });

    btnCloseCalendar?.addEventListener('click', () => {
        if (calendarModal) calendarModal.classList.remove('active');
    });

    calendarModal?.addEventListener('click', (e) => {
        if (e.target === calendarModal) calendarModal.classList.remove('active');
    });

    // --- Init Real Data ---
    if (typeof loadDashboardData === 'function') {
        loadDashboardData();
    }
    if (typeof setupAnalysisForm === 'function') {
        setupAnalysisForm();
    }
    if (typeof animateClock === 'function') {
        animateClock();
    }
});

// ============================================
// LOAD DASHBOARD DATA FROM API
// ============================================
async function loadDashboardData() {
    const userId = BmindSession.getUserId();
    if (!userId) return;

    // Show skeleton loading states
    setLoadingState(true);

    try {
        const res = await fetch(`${API_BASE}/api/dashboard?userId=${userId}`, {
            headers: { 'Authorization': `Bearer ${BmindSession.getToken()}` },
        });

        if (res.status === 401) {
            BmindSession.clear();
            window.location.href = '/index.html';
            return;
        }

        if (!res.ok) throw new Error('Failed to load dashboard data');

        const data = await res.json();
        window.currentTasks = data.tasks || [];
        renderDashboard(data);

    } catch (err) {
        console.error('[Dashboard] Load error:', err.message);
        showDataError(err.message);
    } finally {
        setLoadingState(false);
    }
}

function renderDashboard(data) {
    const { user, plan, tasks, recentMessages, masteryItems } = data;

    // --- Greeting ---
    const greetingEl = document.getElementById('hero-greeting-dynamic');
    if (greetingEl) {
        const hour = new Date().getHours();
        let greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        const activeSources = Object.entries(user.connections || {})
            .filter(([, v]) => v).map(([k]) => k);
        const sourceText = activeSources.length > 0
            ? `<span class="highlight-sources">${activeSources.length} connected source${activeSources.length > 1 ? 's' : ''}</span>`
            : '<span class="highlight-sources">your messages</span>';
        greetingEl.innerHTML = `${greet}, ${user.displayName || 'there'}. Bmind is analyzing ${sourceText}.`;
    }

    // --- Update sidebar user info ---
    const sidebarName = document.querySelector('.sidebar-user-name');
    if (sidebarName && user.displayName) sidebarName.textContent = user.displayName;

    // --- Priority Hero Card ---
    renderPriorityCard(plan, tasks);

    // --- Timeline Rail ---
    renderTimeline(tasks);

    // --- Action Feed ---
    renderActionFeed(recentMessages, tasks);

    // --- Mastery Panel ---
    renderMasteryPanel(masteryItems);

    // --- AI Plan Summary ---
    renderPlanSummary(plan);
}

function renderPriorityCard(plan, tasks) {
    const titleEl = document.querySelector('.priority-title');
    const subtitleEl = document.querySelector('.priority-subtitle');

    if (!titleEl || !subtitleEl) return;

    const topTask = tasks.find(t => t.status === 'pending' || t.status === 'in_progress');

    if (!topTask && (!plan.priorities || plan.priorities.length === 0)) {
        titleEl.textContent = 'All caught up! 🎉';
        subtitleEl.innerHTML = `<span style="color:var(--soft-silver)">No pending tasks. Add messages to analyze.</span>`;
        return;
    }

    const featured = plan.priorities?.[0] || topTask;
    if (featured) {
        titleEl.textContent = featured.title || topTask?.title || 'Check your tasks';
        const source = topTask?.source || 'unknown';
        const srcMeta = SOURCE_META[source] || SOURCE_META.manual;
        const deadlineText = topTask?.deadline
            ? `Due <strong style="color:var(--amber-soon)">${relativeTime(topTask.deadline)}</strong>`
            : 'No deadline set';
        const reason = featured.reason || topTask?.context || 'Extracted from your messages';
        subtitleEl.innerHTML = `
            ${deadlineText} <span style="color:${srcMeta.color};font-size:.8rem;">(${srcMeta.label})</span><br>
            <span class="priority-notes">${reason}</span>
        `;
    }
}

function renderTimeline(tasks) {
    const grid = document.querySelector('.timeline-grid');
    const daysContainer = document.querySelector('.timeline-days');
    if (!grid || !daysContainer) return;

    // Clear existing content
    grid.innerHTML = '';
    daysContainer.innerHTML = '';

    const TOTAL_DAYS = window.timelineMode || 7;
    const now = new Date();
    
    // Create Time Axis (left side labels)
    const timeAxis = document.createElement('div');
    timeAxis.className = 'time-axis';
    for (let h = 0; h <= 24; h += 6) {
        const label = document.createElement('div');
        label.className = 'time-label';
        label.style.top = `${(h / 24) * 100}%`;
        label.textContent = `${h.toString().padStart(2, '0')}:00`;
        timeAxis.appendChild(label);
        
        // Horizontal lines across the entire grid
        const line = document.createElement('div');
        line.className = 'hour-line';
        line.style.top = `${(h / 24) * 100}%`;
        grid.appendChild(line);
    }
    grid.appendChild(timeAxis);

    // 1. Generate the background columns and headers
    for (let i = 0; i < TOTAL_DAYS; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        
        // Header
        const dayCol = document.createElement('div');
        dayCol.className = 'day-col';
        
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dateNum = d.getDate();
        
        if (i === 0) dayCol.innerHTML = `<span class="day-name">Today</span><span class="day-date">${dateNum}</span>`;
        else if (i === 1) dayCol.innerHTML = `<span class="day-name">Tomorrow</span><span class="day-date">${dateNum}</span>`;
        else {
            dayCol.innerHTML = `<span class="day-name">${dayName}</span><span class="day-date">${dateNum}</span>`;
        }
        daysContainer.appendChild(dayCol);

        // Grid Column
        const gridCol = document.createElement('div');
        gridCol.className = 'grid-col';
        if (i === 0) {
            gridCol.classList.add('active');
            // Add current time indicator line
            const hourFrac = (now.getHours() * 60 + now.getMinutes()) / 1440;
            const currentTimeLine = document.createElement('div');
            currentTimeLine.className = 'current-time-line';
            currentTimeLine.style.top = `${hourFrac * 100}%`;
            gridCol.appendChild(currentTimeLine);
        }
        grid.appendChild(gridCol);
    }

    const upcoming = tasks
        .filter(t => t.deadline)
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
        .slice(0, TOTAL_DAYS === 30 ? 20 : 10);

    const maxTimeDiff = TOTAL_DAYS * 24 * 3600000;

    upcoming.forEach((task, idx) => {
        const d = new Date(task.deadline);
        const diff = d - now;
        if (diff < -3600000 || diff >= maxTimeDiff) return; // Show items from 1h ago until end of range

        const dayIdx = Math.floor(diff / 86400000);
        const hourFrac = (d.getHours() * 60 + d.getMinutes()) / 1440;
        const topPct = hourFrac * 100;

        const src = task.source || 'manual';
        const srcMeta = SOURCE_META[src] || SOURCE_META.manual;
        const tagClass = task.priority >= 4 ? 'tag-deadline' :
            src === 'telegram' || src === 'whatsapp' ? 'tag-meeting' : 'tag-study';
            
        const contextText = task.context || `Source: ${srcMeta.label}`;

        const tag = document.createElement('div');
        tag.className = `timeline-tag ${tagClass}`;
        // Calculate horizontal position
        const leftOffset = (dayIdx / TOTAL_DAYS) * 100;
        tag.style.cssText = `left: calc(${leftOffset}% + 12px); top: ${topPct}%;`;
        
        tag.innerHTML = `
            <div class="tag-header">
                <span class="tag-time">${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span class="tag-icon" style="color:${srcMeta.color}">${srcMeta.abbr}</span>
            </div>
            <div class="tag-title">${task.title.substring(0, 25)}${task.title.length > 25 ? '…' : ''}</div>
            <div class="tag-context">${contextText}</div>
        `;
        grid.appendChild(tag);
    });
}

function renderFullCalendar(tasks) {
    const grid = document.getElementById('full-calendar-grid');
    const headers = document.getElementById('full-calendar-days-header');
    if (!grid || !headers) return;

    grid.innerHTML = '';
    headers.innerHTML = '';

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    daysOfWeek.forEach(day => {
        const d = document.createElement('div');
        d.className = 'fc-day-head';
        d.textContent = day;
        headers.appendChild(d);
    });

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startOffset = firstDay.getDay(); 
    const totalDays = lastDay.getDate();

    // Fill empty cells before the 1st
    for (let i = 0; i < startOffset; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'fc-cell empty';
        grid.appendChild(emptyCell);
    }

    // Fill days
    for (let day = 1; day <= totalDays; day++) {
        const cellDate = new Date(currentYear, currentMonth, day);
        const cell = document.createElement('div');
        cell.className = 'fc-cell';
        if (day === now.getDate() && currentMonth === now.getMonth()) {
            cell.classList.add('today');
        }

        // Find tasks for this day
        const dayTasks = tasks.filter(t => {
            if (!t.deadline) return false;
            const tDate = new Date(t.deadline);
            return tDate.getDate() === day && tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
        });

        let taskHtml = '';
        dayTasks.slice(0, 4).forEach(t => {
            const src = t.source || 'manual';
            let tClass = 'fc-task-study';
            if (t.priority >= 4) tClass = 'fc-task-deadline';
            else if (src === 'telegram' || src === 'whatsapp') tClass = 'fc-task-meeting';
            
            const timeStr = new Date(t.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            taskHtml += `<div class="fc-task-item ${tClass}" title="${escapeHtml(t.title)}">${timeStr} ${escapeHtml(t.title)}</div>`;
        });
        
        if (dayTasks.length > 4) {
            taskHtml += `<div style="font-size:0.7rem; color:var(--soft-silver); margin-top:4px;">+${dayTasks.length - 4} more</div>`;
        }

        cell.innerHTML = `
            <div class="fc-date-num">${day}</div>
            <div class="fc-tasks">${taskHtml}</div>
        `;
        grid.appendChild(cell);
    }
}

function renderActionFeed(recentMessages, tasks) {
    const panel = document.getElementById('actions-panel');
    if (!panel) return;

    let listEl = panel.querySelector('.action-list-scrollable') || panel.querySelector('.action-list');
    if (!listEl) {
        listEl = document.createElement('div');
        listEl.className = 'action-list-scrollable';
        listEl.id = 'action-feed-container';
        const header = panel.querySelector('.column-header');
        if (header) header.insertAdjacentElement('afterend', listEl);
        else panel.appendChild(listEl);
    } else {
        listEl.className = 'action-list-scrollable';
        listEl.id = 'action-feed-container';
    }

    if (recentMessages.length === 0 && tasks.length === 0) {
        listEl.innerHTML = `<div class="action-empty">
            <div style="font-size:2rem;margin-bottom:8px">📥</div>
            <div style="color:rgba(255,255,255,.4);font-size:.85rem">No messages analyzed yet.<br>Connect a platform to get started.</div>
        </div>`;
        return;
    }

    const seenPreviews = new Set();
    const uniqueMessages = [];
    for (const msg of recentMessages) {
        const preview = (msg.preview || msg.rawText || '').trim().toLowerCase();
        if (preview && !seenPreviews.has(preview)) {
            seenPreviews.add(preview);
            uniqueMessages.push(msg);
        } else if (!preview) {
             uniqueMessages.push(msg);
        }
    }

    const items = uniqueMessages.slice(0, 15);
    
    listEl.innerHTML = items.map((msg, index) => {
        const srcMeta = SOURCE_META[msg.source] || SOURCE_META.manual;
        let typeClass = 'type-noise';
        let classLabel = 'Ignored';
        
        if (msg.classification === 'ACTIONABLE') {
            typeClass = 'type-action';
            classLabel = 'Task Extracted';
        } else if (msg.classification === 'LEARNING_REQUISITE') {
            typeClass = 'type-learn';
            classLabel = 'Learning Path';
        }

        const time = msg.timestamp ? relativeTime(msg.timestamp) : 'Just now';
        const delay = index * 0.1;

        let primaryAction = '<button class="action-btn">Dismiss</button>';
        if (msg.classification === 'ACTIONABLE') primaryAction = '<button class="action-btn primary">Add to Tasks</button> <button class="action-btn">Dismiss</button>';
        if (msg.classification === 'LEARNING_REQUISITE') primaryAction = '<button class="action-btn primary">Start Learning</button> <button class="action-btn">Dismiss</button>';

        return `
        <div class="action-card-pro ${typeClass} integration-tile" style="animation-delay: ${delay}s">
            <div class="action-card-header">
                <div class="action-source-chip" style="color: ${srcMeta.color}">
                    <span style="display:flex; align-items:center;">${srcMeta.abbr || '•'}</span>
                    <span style="color: var(--white);">${escapeHtml(srcMeta.label || '')}</span>
                </div>
                <span class="action-time-badge">${time}</span>
            </div>
            
            <div class="action-card-body">
                ${msg.conversation ? `<div class="action-card-title">${escapeHtml(msg.conversation)}</div>` : ''}
                <div class="action-card-text">
                    "${escapeHtml(msg.preview || msg.rawText || '—')}"
                </div>
            </div>
            
            <div class="action-card-footer">
                <span class="action-classification-tag">${classLabel}</span>
                <div class="action-card-actions">
                    ${primaryAction}
                </div>
            </div>
        </div>`;
    }).join('');

    const tiles = listEl.querySelectorAll('.action-card-pro');
    tiles.forEach(tile => {
        tile.addEventListener('mousemove', (e) => {
            const rect = tile.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -5;
            const rotateY = ((x - centerX) / centerX) * 5;
            tile.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02) translateY(-4px)`;
            tile.style.zIndex = '10';
        });
        tile.addEventListener('mouseleave', () => {
            tile.style.transform = `perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1) translateY(0)`;
            tile.style.zIndex = '1';
        });
    });
}

function renderMasteryPanel(masteryItems) {
    const panel = document.getElementById('mastery-panel');
    if (!panel) return;

    let listEl = panel.querySelector('.mastery-list');
    if (!listEl) {
        listEl = document.createElement('div');
        listEl.className = 'mastery-list';
        const header = panel.querySelector('.column-header');
        if (header) header.insertAdjacentElement('afterend', listEl);
        else panel.appendChild(listEl);
    }

    if (!masteryItems || masteryItems.length === 0) {
        listEl.innerHTML = `<div class="action-empty">
            <div style="font-size:2rem;margin-bottom:8px">📖</div>
            <div style="color:rgba(255,255,255,.4);font-size:.85rem">No learning resources yet.<br>Bmind will suggest topics from your messages.</div>
        </div>`;
        return;
    }

    listEl.innerHTML = masteryItems.map(item => `
        <div class="mastery-item">
            <div class="mastery-subject" style="color:#818cf8;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;">
                ${escapeHtml(item.subject || 'General')}
            </div>
            <div class="mastery-title" style="color:#e2e8f0;font-weight:600;font-size:.9rem;margin:4px 0;">
                ${escapeHtml(item.title)}
            </div>
            ${item.description ? `<div class="mastery-desc" style="color:rgba(255,255,255,.45);font-size:.8rem;line-height:1.4">${escapeHtml(item.description)}</div>` : ''}
        </div>
    `).join('');
}

function renderPlanSummary(plan) {
    // Inject AI summary into the priority card if element exists
    const summaryEl = document.getElementById('ai-plan-summary');
    if (summaryEl && plan.summary) {
        summaryEl.textContent = plan.summary;
    }

    // Update Neural Context Widget if it exists
    const neuralContent = document.querySelector('.context-content');
    if (neuralContent && plan.priorities?.length > 0) {
        neuralContent.innerHTML = `
            <div style="color:#94a3b8;font-size:.8rem;margin-bottom:12px">${plan.summary}</div>
            <div style="color:#a5b4fc;font-size:.75rem;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">Top Priorities</div>
            ${plan.priorities.slice(0, 3).map((p, i) => `
                <div style="padding:10px;background:rgba(99,102,241,.08);border-radius:8px;margin-bottom:8px;">
                    <div style="color:#e2e8f0;font-size:.85rem;font-weight:600">${i + 1}. ${escapeHtml(p.title)}</div>
                    <div style="color:#94a3b8;font-size:.78rem;margin-top:4px">${escapeHtml(p.reason || '')}</div>
                    ${p.estimated_minutes ? `<div style="color:#6366f1;font-size:.75rem;margin-top:4px">~${p.estimated_minutes} min</div>` : ''}
                </div>
            `).join('')}
        `;
    }
}

// ============================================
// ANALYSIS FORM (test message input)
// ============================================
function setupAnalysisForm() {
    const form = document.getElementById('analyze-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = form.querySelector('#analyze-input');
        const sourceSelect = form.querySelector('#analyze-source');
        const resultEl = form.querySelector('#analyze-result');
        const btn = form.querySelector('button[type=submit]');

        if (!input?.value.trim()) return;

        btn.disabled = true;
        btn.textContent = 'Analyzing...';
        if (resultEl) resultEl.innerHTML = '<span style="color:#94a3b8">Running Groq analysis…</span>';

        try {
            const res = await fetch(`${API_BASE}/api/dashboard/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: BmindSession.getUserId(),
                    text: input.value.trim(),
                    source: sourceSelect?.value || 'manual',
                }),
            });
            const data = await res.json();

            if (resultEl) {
                const cls = data.classification;
                const color = cls === 'ACTIONABLE' ? '#4ade80' : cls === 'LEARNING_REQUISITE' ? '#60a5fa' : '#94a3b8';
                resultEl.innerHTML = `
                    <div style="color:${color};font-weight:700;margin-bottom:8px">
                        ${cls === 'ACTIONABLE' ? '✅ ACTIONABLE' : cls === 'LEARNING_REQUISITE' ? '📚 LEARNING' : '🔕 NOISE'}
                    </div>
                    ${data.data?.task ? `<div style="color:#e2e8f0;margin-bottom:4px"><strong>Task:</strong> ${escapeHtml(data.data.task)}</div>` : ''}
                    ${data.data?.deadline ? `<div style="color:#fbbf24;margin-bottom:4px"><strong>Deadline:</strong> ${data.data.deadline}</div>` : ''}
                    ${data.data?.subject ? `<div style="color:#60a5fa;margin-bottom:4px"><strong>Subject:</strong> ${escapeHtml(data.data.subject)}</div>` : ''}
                    ${data.data?.context ? `<div style="color:#94a3b8;font-size:.83rem">${escapeHtml(data.data.context)}</div>` : ''}
                `;
            }

            input.value = '';
            // Reload dashboard to reflect new data
            setTimeout(() => loadDashboardData(), 1000);

        } catch (err) {
            if (resultEl) resultEl.innerHTML = `<span style="color:#f87171">Error: ${err.message}</span>`;
        } finally {
            btn.disabled = false;
            btn.textContent = 'Analyze';
        }
    });
}
// ============================================
// CLOCK ANIMATION
// ============================================
function animateClock() {
    const hourHand = document.querySelector('.clock-hand.hours');
    const minuteHand = document.querySelector('.clock-hand.minutes');
    const secondHand = document.querySelector('.clock-hand.seconds');
    if (!hourHand) return;

    function tick() {
        const now = new Date();
        const s = now.getSeconds();
        const m = now.getMinutes();
        const h = now.getHours() % 12;
        if (secondHand) secondHand.style.transform = `rotate(${s * 6}deg)`;
        if (minuteHand) minuteHand.style.transform = `rotate(${m * 6 + s * 0.1}deg)`;
        if (hourHand) hourHand.style.transform = `rotate(${h * 30 + m * 0.5}deg)`;
    }
    tick();
    setInterval(tick, 1000);
}

// ============================================
// UTILS
// ============================================
function setLoadingState(loading) {
    const skeleton = document.getElementById('dashboard-skeleton');
    if (skeleton) skeleton.style.display = loading ? 'flex' : 'none';
}

function showDataError(msg) {
    const greetingEl = document.getElementById('hero-greeting-dynamic');
    if (greetingEl) {
        greetingEl.innerHTML = `<span style="color:#f87171">⚠ Could not load data: ${escapeHtml(msg)}</span>`;
    }
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toggleAction(checkbox) {
    const actionItem = checkbox.closest('.action-item');
    checkbox.classList.toggle('checked');
    actionItem?.classList.toggle('checked');
}

function relativeTime(dateString) {
    const diffMs = new Date(dateString) - new Date();
    const diffSec = Math.round(diffMs / 1000);
    const absDiff = Math.abs(diffSec);

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    if (absDiff < 60) return rtf.format(Math.round(diffSec), 'second');
    if (absDiff < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
    if (absDiff < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
    return rtf.format(Math.round(diffSec / 86400), 'day');
}
