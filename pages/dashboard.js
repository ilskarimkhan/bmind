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
            const href = link.getAttribute('href');
            if (!href || href === '#' || href === '') {
                e.preventDefault();
                sidebarLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
    });

    // --- Entrance Animations ---
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
    const railScroll = document.querySelector('.rail-scroll');
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
        // Toggle on click
        neuralTrigger.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document click from immediately closing it
            contextWidget.classList.toggle('expanded');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (contextWidget.classList.contains('expanded') && !contextWidget.contains(e.target)) {
                contextWidget.classList.remove('expanded');
            }
        });
        
        // Prevent clicks inside panel from closing it
        contextWidget.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

});
function toggleAction(checkbox) {
    const actionItem = checkbox.closest('.action-item');
    checkbox.classList.toggle('checked');
    actionItem.classList.toggle('checked');
}
