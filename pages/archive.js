// ============================================
// BMIND ARCHIVE — Script
// ============================================

document.addEventListener('DOMContentLoaded', () => {

    const inspectorPanel = document.getElementById('inspector-panel');
    const inspectorOverlay = document.getElementById('inspector-overlay');
    const btnCloseInspector = document.getElementById('btn-close-inspector');
    
    // UI Elements inside Inspector to update dynamically
    const inspectTask = document.getElementById('inspect-task');
    const snippetApp = document.querySelector('.snippet-app');
    const snippetSender = document.querySelector('.snippet-sender');
    const snippetBody = document.querySelector('.snippet-body');

    // Mock Database Mapping based on data-origin-id
    const originData = {
        't-1': {
            task: 'Finalize Biology Paper.',
            app: 'Gmail',
            appColor: 'rgba(234, 67, 53, 0.8)',
            sender: 'From: Prof. Chen',
            body: '"Hello everyone, just a reminder that the final draft of your Biology Paper is due this Friday by 5:00 PM. Please ensure all peer review comments have been addressed."'
        },
        't-2': {
            task: 'Review Mitosis Chapter 4-6',
            app: 'Telegram',
            appColor: 'rgba(0, 136, 204, 0.8)',
            sender: 'From: Study Group',
            body: '"Are we still meeting at the library? We really need to go over the mitosis stages, Chapters 4-6 are going to be on the midterm for sure."'
        },
        't-3': {
            task: 'Send outline to Sarah',
            app: 'WhatsApp',
            appColor: 'rgba(37, 211, 102, 0.8)',
            sender: 'From: Group Project',
            body: '"Hey Rinat, could you send your part of the outline to Sarah by EOD? She is compiling the final document." '
        },
        'tr-1': {
            task: 'Biology Paper Final',
            app: 'Gmail',
            appColor: 'rgba(234, 67, 53, 0.8)',
            sender: 'From: Dropbox',
            body: '"Your file \'Biology_Final_Draft_v3.pdf\' was successfully uploaded to the shared folder."'
        },
        'tr-2': {
            task: 'Sprint Presentation',
            app: 'Slack',
            appColor: 'rgba(224, 30, 90, 0.8)',
            sender: 'From: Design Team',
            body: '"Great presentation today. Let\'s make sure the new Dashboard layout tickets are created for the next sprint."'
        },
        'tr-3': {
            task: 'Read Ch. 4 & 5',
            app: 'Bmind Logic',
            appColor: 'var(--neon-violet)',
            sender: 'From: System Insight',
            body: 'Focus Session Completed (90m). "You maintained a 95% deep focus score during this reading session."'
        }
    };

    // Open Inspector Function
    function openInspector(originId) {
        if (!inspectorPanel || !inspectorOverlay) return;

        const data = originData[originId];
        if (data) {
            // Update UI
            inspectTask.textContent = data.task;
            snippetApp.textContent = data.app;
            snippetApp.style.color = data.appColor;
            snippetSender.textContent = data.sender;
            snippetBody.textContent = data.body;
        }

        inspectorOverlay.classList.add('active');
        inspectorPanel.classList.add('active');
    }

    // Close Inspector Function
    function closeInspector() {
        if (!inspectorPanel || !inspectorOverlay) return;
        inspectorOverlay.classList.remove('active');
        inspectorPanel.classList.remove('active');
    }

    // Attach click events to Timeline cards and Trophy cards
    const archiveCards = document.querySelectorAll('.ghost-card, .trophy-card');
    archiveCards.forEach(card => {
        card.addEventListener('click', () => {
            const originId = card.getAttribute('data-origin-id');
            openInspector(originId);
        });
    });

    // Attach close events
    if (btnCloseInspector) {
        btnCloseInspector.addEventListener('click', closeInspector);
    }
    if (inspectorOverlay) {
        inspectorOverlay.addEventListener('click', closeInspector);
    }

    // Escape key handling
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeInspector();
        }
    });

});
