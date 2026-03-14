// ============================================================
// DASHBOARD PATCH JS
// Applies the CSS fixes for Timeline, Mastery Path, and Action Feed
// by overriding global render functions from app.js
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inject Universal Depth Modal into the DOM if it doesn't exist
    if (!document.getElementById('bmind-universal-modal')) {
        const modalHtml = `
        <div class="bmind-modal-overlay" id="bmind-universal-modal">
            <div class="bmind-modal">
                <button class="bmind-modal-close" id="btn-close-universal-modal">✕</button>
                <div id="univ-modal-badge" class="modal-badge"></div>
                <h2 id="univ-modal-title" class="modal-title"></h2>
                
                <div id="univ-modal-meta" class="modal-meta-row"></div>
                <div class="modal-divider"></div>
                
                <div id="univ-modal-context-header" class="modal-section-label"></div>
                <div id="univ-modal-context" class="modal-context-box"></div>
                
                <div id="univ-modal-progress-container" style="display: none;">
                    <div class="modal-section-label">Progress</div>
                    <div class="modal-progress-bar"><div id="univ-modal-progress-fill" class="modal-progress-fill"></div></div>
                </div>
                
                <div id="univ-modal-tags" class="modal-tags-row"></div>
                
                <div id="univ-modal-actions" class="modal-action-row"></div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Bind close events
        const overlay = document.getElementById('bmind-universal-modal');
        const closeBtn = document.getElementById('btn-close-universal-modal');
        
        closeBtn.addEventListener('click', () => {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('open');
                document.body.style.overflow = '';
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('open')) {
                overlay.classList.remove('open');
                document.body.style.overflow = '';
            }
        });
    }

    // 2. Function to open the Universal Modal
    window.openUniversalModal = function(data, type) {
        const overlay = document.getElementById('bmind-universal-modal');
        const objBadge = document.getElementById('univ-modal-badge');
        const objTitle = document.getElementById('univ-modal-title');
        const objMeta = document.getElementById('univ-modal-meta');
        const objContextHeader = document.getElementById('univ-modal-context-header');
        const objContext = document.getElementById('univ-modal-context');
        const objTags = document.getElementById('univ-modal-tags');
        const objActions = document.getElementById('univ-modal-actions');
        const progressContainer = document.getElementById('univ-modal-progress-container');
        const progressFill = document.getElementById('univ-modal-progress-fill');

        // Reset
        objMeta.innerHTML = '';
        objTags.innerHTML = '';
        objActions.innerHTML = '';
        progressContainer.style.display = 'none';

        if (type === 'timeline') {
            objBadge.className = `modal-badge ${data.tagClass || 'task'}`;
            let iconText = '';
            if (data.tagClass === 'meeting') iconText = '📅 Meeting';
            else if (data.tagClass === 'study') iconText = '📚 Study';
            else if (data.tagClass === 'deadline') iconText = '⏰ Deadline';
            else iconText = '⚡ Task';
            objBadge.innerHTML = iconText;

            objTitle.textContent = data.title;
            
            // Meta chips
            const d = new Date(data.deadline);
            const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            objMeta.innerHTML = `
                <div class="modal-meta-chip"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${dateStr}, ${timeStr}</div>
                <div class="modal-meta-chip"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Source: ${data.sourceLabel}</div>
            `;

            objContextHeader.textContent = 'Context / Original Message';
            objContext.textContent = data.context || 'No additional context provided.';

            objActions.innerHTML = `
                <button class="modal-btn primary" onclick="closeUniversalModal()">Acknowledge</button>
                <button class="modal-btn secondary">Reschedule</button>
            `;
        } else if (type === 'mastery') {
            objBadge.className = 'modal-badge mastery';
            objBadge.innerHTML = '🎯 Mastery Path';
            
            objTitle.textContent = data.title;
            
            objMeta.innerHTML = `
                <div class="modal-meta-chip"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> ${data.subject || 'Topic'}</div>
            `;

            objContextHeader.textContent = 'Deep Syllabus / Analysis';
            objContext.innerHTML = (data.description || 'Module details.').replace(/\n/g, '<br><br>');

            progressContainer.style.display = 'block';
            setTimeout(() => { progressFill.style.width = '35%'; }, 100);

            objTags.innerHTML = `
                <div class="modal-tag">Prerequisites Met</div>
                <div class="modal-tag">Deep Work</div>
                <div class="modal-tag">Core Concept</div>
            `;

            objActions.innerHTML = `
                <button class="modal-btn primary">Begin Module</button>
                <button class="modal-btn secondary" onclick="closeUniversalModal()">Close</button>
            `;
        }

        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    };

    window.closeUniversalModal = function() {
        const overlay = document.getElementById('bmind-universal-modal');
        if (overlay) {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        }
    };


    // 3. Keep original render Timeline, but append the click listener for modal
    const originalRenderTimeline = window.renderTimeline;
    if (typeof originalRenderTimeline === 'function') {
        window.renderTimeline = function(tasks) {
            // Call original to draw everything
            originalRenderTimeline(tasks);

            // Re-select drawn tags and attach modal opening logic
            const grid = document.querySelector('.timeline-grid');
            if (!grid) return;
            
            const TOTAL_DAYS = window.timelineMode || 7;
            const upcoming = tasks
                .filter(t => t.deadline)
                .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
                .slice(0, TOTAL_DAYS === 30 ? 20 : 10);
            
            const tags = grid.querySelectorAll('.timeline-tag');
            tags.forEach((tag, idx) => {
                const task = upcoming[idx];
                if (!task) return;
                
                const srcInfo = (typeof SOURCE_META !== 'undefined' && SOURCE_META[task.source]) 
                    ? SOURCE_META[task.source] 
                    : { label: 'Manual' };
                
                const tagClass = tag.classList.contains('tag-deadline') ? 'deadline' :
                                 tag.classList.contains('tag-meeting') ? 'meeting' : 'study';

                tag.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.openUniversalModal({
                        title: task.title,
                        deadline: task.deadline,
                        sourceLabel: srcInfo.label,
                        context: task.context,
                        tagClass: tagClass
                    }, 'timeline');
                });
            });
        };
    }

    // 4. Override renderMasteryPanel completely to use new UI logic
    window.renderMasteryPanel = function(masteryItems) {
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

        // We bind the data inside a data attribute so we can open the deep modal
        window._masteryData = masteryItems;

        listEl.innerHTML = masteryItems.map((item, idx) => `
            <div class="mastery-item integration-tile" onclick="window.openUniversalModal(window._masteryData[${idx}], 'mastery')" style="padding: 14px 16px; margin-bottom: 12px; cursor: pointer; border-radius: 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.07); transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);">
                <div class="mastery-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div class="mastery-subject" style="color:#818cf8;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;">
                            ${escapeHtml(item.subject || 'General')}
                        </div>
                        <div class="mastery-title" style="color:#e2e8f0;font-weight:600;font-size:.95rem;margin:4px 0 0 0;">
                            ${escapeHtml(item.title)}
                        </div>
                    </div>
                </div>
                
                ${item.description ? `
                <div style="margin-top: 8px;">
                    <button class="mastery-quick-expand" data-idx="${idx}">
                        Quick Summary <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                </div>
                <div class="mastery-mini-detail" id="mastery-mini-${idx}" style="margin-top: 8px;">
                    ${escapeHtml(item.description).substring(0, 150)}${item.description.length > 150 ? '...' : ''}
                </div>
                ` : ''}
            </div>
        `).join('');

        // Attach quick expand toggles
        const expandBtns = listEl.querySelectorAll('.mastery-quick-expand');
        expandBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = btn.getAttribute('data-idx');
                const miniPanel = document.getElementById(`mastery-mini-${idx}`);
                if (miniPanel) {
                    const isClosed = !miniPanel.classList.contains('open');
                    
                    // Close all others first for accordion effect (optional, feels cleaner)
                    document.querySelectorAll('.mastery-mini-detail').forEach(p => p.classList.remove('open'));
                    document.querySelectorAll('.mastery-quick-expand').forEach(b => b.classList.remove('expanded'));
                    
                    if (isClosed) {
                        miniPanel.classList.add('open');
                        btn.classList.add('expanded');
                    }
                }
            });
        });
    };

    // 5. Override renderActionFeed EMPTY state to utilize the new af-demo-card 
    const originalRenderActionFeed = window.renderActionFeed;
    if (typeof originalRenderActionFeed === 'function') {
        window.renderActionFeed = function(recentMessages, tasks) {
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
            
            // Generate list of action items normally
            const seenPreviews = new Set();
            const uniqueMessages = [];
            for (const msg of recentMessages) {
                if (msg.classification !== 'ACTIONABLE' && msg.classification !== 'LEARNING_REQUISITE') continue;
                const preview = (msg.preview || msg.rawText || '').trim().toLowerCase();
                if (preview && !seenPreviews.has(preview)) {
                    seenPreviews.add(preview);
                    uniqueMessages.push(msg);
                } else if (!preview) {
                     uniqueMessages.push(msg);
                }
            }

            // If empty, show the premium UI from dashboard_patch.css instead of text
            if (uniqueMessages.length === 0) {
                listEl.innerHTML = `
                    <div class="af-demo-notice">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        No active items detected. Awaiting new messages...
                    </div>
                    
                    <div class="af-demo-shimmer-label">Example Patterns</div>
                    
                    <div class="af-demo-card af-course" style="margin-bottom: 12px;">
                        <div class="af-demo-top">
                            <div class="af-icon-wrap">🧠</div>
                            <div class="af-demo-title">Cellular Biology Ch 4-6</div>
                            <div class="af-demo-badge">Learning</div>
                        </div>
                        <div class="af-demo-desc">"Review the mitosis cycle and cell division principles before the midterm."</div>
                        <div class="af-demo-footer">
                            <div class="af-demo-progress">
                                <div class="af-demo-progress-bar"><div class="af-demo-progress-fill" style="width: 45%;"></div></div>
                            </div>
                            <div class="af-demo-time">Suggested next</div>
                        </div>
                    </div>
                    
                    <div class="af-demo-card af-deadline" style="margin-bottom: 12px; opacity: 0.85;">
                        <div class="af-demo-top">
                            <div class="af-icon-wrap">⏰</div>
                            <div class="af-demo-title">Submit Project Update</div>
                            <div class="af-demo-badge">Action</div>
                        </div>
                        <div class="af-demo-desc">"Please push the latest styling changes to the repository by EOD."</div>
                        <div class="af-demo-footer">
                            <div class="af-demo-time">Extracted from Slack</div>
                        </div>
                    </div>
                `;
                return;
            }
            
            // Otherwise, let the original handler take care of rendering real items
            originalRenderActionFeed(recentMessages, tasks);
        };
    }

    // Helper: escapeHtml copied from app.js as it is not exported
    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    // Trigger immediate re-render of components if data is already loaded globally
    if (window.currentTasks && window.currentMessages) {
        if (typeof renderTimeline === 'function') renderTimeline(window.currentTasks);
        if (typeof renderActionFeed === 'function') renderActionFeed(window.currentMessages, window.currentTasks);
        // Ensure masteryItems exists global scope or fetch it via typical load 
        // Or wait for next data load.
    }

    // ============================================================
    // FOCUS SESSION OVERLAY LOGIC
    // ============================================================
    const focusOverlay = document.getElementById('focus-session-page');
    const btnExitFocus = document.getElementById('btn-exit-focus');

    // Global function to open focus session so it can be called from dynamically rendered HTML
    window.openFocusSession = function(contextData = null) {
        if (!focusOverlay) return;
        
        // Dynamically inject context if provided (e.g. from mastery item)
        if (contextData) {
            const subjectEl = document.getElementById('fs-subject');
            const titleEl = document.getElementById('fs-title');
            const contextEl = document.getElementById('fs-context');
            if (subjectEl) subjectEl.textContent = contextData.subject || 'Focus';
            if (titleEl) titleEl.textContent = contextData.title || 'Deep Work Session';
            if (contextEl && contextData.description) {
               contextEl.textContent = `"${contextData.description.substring(0, 150)}..."`;
            }
        }

        focusOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

        // Populate the selectable goals from currentTasks
        populateFocusGoals();
    };

    function populateFocusGoals() {
        const goalsList = document.getElementById('fs-goals-list');
        if (!goalsList) return;

        const tasks = window.currentTasks || [];
        if (tasks.length === 0) {
            goalsList.innerHTML = '<div style="color: rgba(255,255,255,0.4); font-size: 0.8rem; padding: 10px;">No active tasks found in context.</div>';
            return;
        }

        goalsList.innerHTML = tasks.map((task, idx) => `
            <div class="goal-item selectable-goal" data-idx="${idx}">
                <div class="goal-bullet"></div>
                <span class="goal-text">${escapeHtml(task.title)}</span>
            </div>
        `).join('');

        // Attach clicks
        const items = goalsList.querySelectorAll('.selectable-goal');
        items.forEach(item => {
            item.addEventListener('click', () => {
                items.forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                
                // Update the main panel preview
                const task = tasks[item.getAttribute('data-idx')];
                const titleEl = document.getElementById('fs-title');
                const contextEl = document.getElementById('fs-context');
                
                if (titleEl) titleEl.textContent = task.title;
                if (contextEl) contextEl.textContent = `"${task.context || 'Goal extracted from your recent activity.'}"`;
                
                // Set as current focus target
                window._currentFocusTarget = task;
            });
        });
        
        // Auto-select first
        if (items.length > 0) items[0].click();
    }

    // Timer Preview Selection
    const durationSelect = document.getElementById('fs-duration-select');
    const timerPreview = document.getElementById('fs-timer-preview');
    if (durationSelect && timerPreview) {
        durationSelect.addEventListener('change', () => {
            timerPreview.textContent = `${durationSelect.value}:00`;
        });
    }

    if (btnExitFocus) {
        btnExitFocus.addEventListener('click', () => {
            if (focusOverlay) {
                focusOverlay.classList.remove('active');
                document.body.style.overflow = ''; 
            }
        });
    }

    // Start Deep Work Transition
    const btnBeginDeepWork = document.getElementById('btn-begin-deep-work');
    const deepWorkPage = document.getElementById('deep-work-page');
    const btnExitDeepWork = document.getElementById('btn-exit-deep-work');

    if (btnBeginDeepWork) {
        btnBeginDeepWork.addEventListener('click', () => {
            if (!deepWorkPage) return;
            
            const duration = parseInt(durationSelect?.value || '25');
            const target = window._currentFocusTarget || { title: "Focused Session" };
            
            // Transition
            if (focusOverlay) focusOverlay.classList.remove('active');
            deepWorkPage.classList.add('active');
            
            // Initialize Deep Work Active View
            startDeepWorkSession(target, duration);
        });
    }

    if (btnExitDeepWork) {
        btnExitDeepWork.addEventListener('click', () => {
            if (deepWorkPage) {
                deepWorkPage.classList.remove('active');
                document.body.style.overflow = '';
                stopDeepWorkTimer();
            }
        });
    }

    let deepWorkInterval = null;
    let secondsRemaining = 0;
    let totalSeconds = 0;

    function startDeepWorkSession(target, minutes) {
        // UI Setup
        const dwTitle = document.getElementById('dw-target-title');
        if (dwTitle) dwTitle.textContent = target.title;
        
        const dwTimer = document.getElementById('dw-timer-countdown');
        secondsRemaining = minutes * 60;
        totalSeconds = minutes * 60;
        updateTimerUI();
        
        // Start Interval
        stopDeepWorkTimer(); // Clear existing
        deepWorkInterval = setInterval(() => {
            secondsRemaining--;
            if (secondsRemaining <= 0) {
                stopDeepWorkTimer();
                // Play sound or show finish notification?
            }
            updateTimerUI();
        }, 1000);
        
        // Fetch AI Data
        fetchDeepWorkIntelligence(target);
    }

    function stopDeepWorkTimer() {
        if (deepWorkInterval) clearInterval(deepWorkInterval);
        deepWorkInterval = null;
    }

    function updateTimerUI() {
        const dwTimer = document.getElementById('dw-timer-countdown');
        const dwRing = document.getElementById('dw-ring-progress');
        
        if (dwTimer) {
            const m = Math.floor(secondsRemaining / 60);
            const s = secondsRemaining % 60;
            dwTimer.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        
        if (dwRing) {
            const circumference = 565.48;
            const progress = (totalSeconds - secondsRemaining) / totalSeconds;
            const offset = circumference - (progress * circumference);
            dwRing.style.strokeDashoffset = offset;
        }
    }

    async function fetchDeepWorkIntelligence(target) {
        const loader = document.getElementById('dw-ai-loading');
        const content = document.getElementById('dw-ai-content');
        if (!loader || !content) return;
        
        loader.style.display = 'flex';
        content.style.display = 'none';
        
        try {
            const userId = (window.BmindSession && window.BmindSession.user_id) || 'demo-user';
            const resp = await fetch(`http://localhost:3001/api/focus/start?userId=${userId}&topic=${encodeURIComponent(target.title)}&context=${encodeURIComponent(target.context || '')}`);
            const data = await resp.json();
            
            if (data.success && data.plan) {
                renderAIIntelligence(data.plan);
            }
        } catch (err) {
            console.error('Focus API failed:', err);
            // Fallback to static example if API fails
            renderAIIntelligence({
                searchData: {
                    micro_wins: [{ step: "Write down the 3 hardest topics you struggle with in Kazakh SAT", time_minutes: 5 }],
                    difficulty_levels: [{ title: "Foundational Grammar", level: "Beginner", description: "Start with cases and suffixes." }],
                    search_queries: ["Kazakh SAT prep guide", "Kazakh grammar for beginners"]
                }
            });
        } finally {
            loader.style.display = 'none';
            content.style.display = 'block';
        }
    }

    function renderAIIntelligence(plan) {
        const microWins = document.getElementById('dw-micro-wins');
        const lessons = document.getElementById('dw-lessons');
        const queries = document.getElementById('dw-queries');
        
        const search = plan.searchData || {};
        
        if (microWins) {
            microWins.innerHTML = (search.micro_wins || []).map(w => `
                <div class="dw-res-item">
                    <div class="dw-res-title">Win: ${escapeHtml(w.step)}</div>
                    <div class="dw-res-desc">${w.time_minutes} minutes • Direct action</div>
                </div>
            `).join('');
        }
        
        if (lessons) {
            lessons.innerHTML = (search.difficulty_levels || []).map(l => `
                <div class="dw-res-item">
                    <div class="dw-res-title">${escapeHtml(l.title)} [${l.level}]</div>
                    <div class="dw-res-desc">${escapeHtml(l.description)}</div>
                </div>
            `).join('');
        }
        
        if (queries) {
            queries.innerHTML = `<div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${(search.search_queries || []).map(q => `<span class="dw-search-tag">${escapeHtml(q)}</span>`).join('')}
            </div>`;
        }
    }

    // Attach to any statically rendered buttons
    document.addEventListener('click', (e) => {
        if (e.target.closest('.btn-start-focus')) {
            window.openFocusSession();
        }
    });
});