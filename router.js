// ============================================
// BMIND SPA ROUTER
// Handles view switching without page reloads
// ============================================

document.addEventListener('DOMContentLoaded', () => {

    const sidebarLinks = document.querySelectorAll('.sidebar-link[data-view]');
    const views = document.querySelectorAll('.app-view');

    function navigateTo(viewId, pushState = true) {
        // Hide all views
        views.forEach(view => {
            view.classList.remove('active');
        });

        // Deactivate all sidebar links
        sidebarLinks.forEach(link => {
            link.classList.remove('active');
        });

        // Show target view
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
        }

        // Activate target sidebar link
        const targetLink = document.querySelector(`.sidebar-link[data-view="${viewId}"]`);
        if (targetLink) {
            targetLink.classList.add('active');
        }

        // Scroll main content to top
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.scrollTop = 0;
        }

        // Update browser URL hash
        if (pushState) {
            const hash = viewId.replace('view-', '');
            history.pushState({ view: viewId }, '', `#${hash}`);
        }

        // Update page title
        const titles = {
            'view-pulse': 'Bmind — Dashboard',
            'view-library': 'Bmind — Library',
            'view-archive': 'Bmind — Memory Bank',
            'view-connections': 'Bmind — Connections'
        };
        document.title = titles[viewId] || 'Bmind';
    }

    // Attach click listeners to sidebar links
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = link.getAttribute('data-view');
            navigateTo(viewId);
        });
    });

    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.view) {
            navigateTo(e.state.view, false);
        } else {
            // Fallback: parse hash
            const hash = window.location.hash.replace('#', '');
            if (hash) {
                navigateTo('view-' + hash, false);
            } else {
                navigateTo('view-pulse', false);
            }
        }
    });

    // On initial load, check hash
    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && document.getElementById('view-' + initialHash)) {
        navigateTo('view-' + initialHash, false);
    }

});
