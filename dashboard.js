// ============================================
// BMIND DASHBOARD — Script
// ============================================

document.addEventListener('DOMContentLoaded', () => {

    // --- Dynamic Greeting Based on Time ---
    const heroGreetingDynamic = document.getElementById('hero-greeting-dynamic');
    if (heroGreetingDynamic) {
        const hour = new Date().getHours();
        let greeting = 'Good morning';
        if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
        else if (hour >= 17) greeting = 'Good evening';

        heroGreetingDynamic.innerHTML = `${greeting}, Alex. Bmind is analyzing <span class="highlight-sources">4 new sources</span>.`;
    }

    // --- Sidebar Active State ---
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // --- Entrance Animations ---
    const animateElements = [
        { el: document.getElementById('hero-card'), delay: 0 },
        { el: document.getElementById('deadline-rail'), delay: 150 },
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
    const railScroll = document.querySelector('.rail-scroll');
    if (railScroll) {
        railScroll.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                railScroll.scrollLeft += e.deltaY;
            }
        }, { passive: false });
    }

});

// --- Toggle Action Checkbox ---
function toggleAction(checkbox) {
    const actionItem = checkbox.closest('.action-item');
    checkbox.classList.toggle('checked');
    actionItem.classList.toggle('checked');
}
