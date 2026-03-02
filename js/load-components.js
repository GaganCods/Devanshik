/**
 * DEVANSHIK — Component Loader & Mobile Sidebar Controller
 * Loads header/footer HTML, wires mobile sidebar, cart badge, and auth.
 */

// STEP 4 - Prevent flicker globally by hiding login buttons instantly
if (localStorage.getItem("user_profile") || localStorage.getItem("user_cache")) {
    const style = document.createElement('style');
    style.textContent = '#login-btn, #mobile-login-btn { display: none !important; }';
    document.head.appendChild(style);
}

// ─── Load HTML component into a container ─────────────────────
async function loadComponent(id, file) {
    const el = document.getElementById(id);
    if (!el) return false;
    try {
        const res = await fetch(file);
        if (!res.ok) throw new Error(`Failed to load ${file}`);
        el.innerHTML = await res.text();
        return true;
    } catch (err) {
        console.error(`Component load error (${file}):`, err);
        return false;
    }
}

// ─── Admin Sidebar Loader ─────────────────────────────────────
async function loadAdminSidebar(activePath) {
    // Find or create a container element
    let container = document.getElementById('admin-sidebar-container');
    if (!container) {
        // Create and prepend a container for the sidebar if not present
        container = document.createElement('div');
        container.id = 'admin-sidebar-container';
        document.body.prepend(container);
    }
    try {
        const res = await fetch('/components/admin-sidebar.html');
        if (!res.ok) throw new Error('Could not load admin sidebar');
        container.innerHTML = await res.text();

        // Highlight active link — exact match first, then starts-with for sub-paths
        const links = container.querySelectorAll('.admin-nav a[data-path]');
        links.forEach(link => {
            const path = link.getAttribute('data-path');
            // Exact match or the active path starts with the link path (but not for root /admin)
            const isActive = (activePath === path) ||
                (path !== '/admin' && activePath.startsWith(path));
            if (isActive) link.classList.add('active');
        });
    } catch (err) {
        console.error('Admin sidebar load error:', err);
    }
}

// ─── Mobile Sidebar Controller ────────────────────────────────
function initMobileSidebar() {
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('mobile-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const closeBtn = document.getElementById('sidebar-close');

    if (!hamburger || !sidebar) return;

    function openSidebar() {
        sidebar.classList.add('open');
        sidebar.setAttribute('aria-hidden', 'false');
        overlay.classList.add('active');
        hamburger.classList.add('open');
        hamburger.setAttribute('aria-expanded', 'true');
        document.body.classList.add('sidebar-open');   // body scroll lock
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebar.setAttribute('aria-hidden', 'true');
        overlay.classList.remove('active');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('sidebar-open');
    }

    // Hamburger toggle
    hamburger.addEventListener('click', () => {
        sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });

    // Close button inside sidebar
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);

    // Overlay click closes sidebar
    if (overlay) overlay.addEventListener('click', closeSidebar);

    // Any link inside sidebar closes it
    sidebar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeSidebar);
    });

    // Escape key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
            closeSidebar();
        }
    });
}

// ─── Cart Badge Sync ──────────────────────────────────────────
function syncCartBadges() {
    if (typeof updateCartBadge === 'function') {
        updateCartBadge();
    }

    // Also sync the sidebar cart badge
    try {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const total = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        document.querySelectorAll('.sidebar-cart-count').forEach(el => {
            el.textContent = total;
            el.classList.toggle('hidden', total === 0);
        });
    } catch (e) { /* ignore */ }
}

// ─── Wire sidebar auth state ──────────────────────────────────
function wireSidebarAuth() {
    // Called by auth.js after it updates the header auth state
    // We hook into firebase directly so sidebar stays in sync
    if (typeof firebase === 'undefined') return;

    firebase.auth().onAuthStateChanged(async user => {
        const loginLink = document.getElementById('sidebar-login-link');
        const footerLoginLink = document.getElementById('footer-login-link');
        const profileSec = document.getElementById('sidebar-profile-section');
        const nameEl = document.getElementById('sidebar-user-name');
        const emailEl = document.getElementById('sidebar-user-email');
        const initialEl = document.getElementById('sidebar-user-initial');
        const adminLink = document.getElementById('sidebar-admin-link');

        if (user) {
            if (loginLink) loginLink.classList.add('hidden');
            if (footerLoginLink) footerLoginLink.classList.add('hidden');
            if (profileSec) profileSec.classList.remove('hidden');

            const name = user.displayName || user.email.split('@')[0];
            const initial = (user.displayName ? user.displayName[0] : user.email[0]).toUpperCase();

            if (nameEl) nameEl.textContent = name;
            if (emailEl) emailEl.textContent = user.email;
            if (initialEl) initialEl.textContent = initial;

            // Admin link
            try {
                const snap = await firebase.database().ref(`users/${user.uid}/role`).once('value');
                if (snap.val() === 'admin' && adminLink) {
                    adminLink.classList.remove('hidden');
                }
            } catch (e) { /* ignore */ }

        } else {
            if (loginLink) loginLink.classList.remove('hidden');
            if (footerLoginLink) footerLoginLink.classList.remove('hidden');
            if (profileSec) profileSec.classList.add('hidden');
        }
    });

    // Sidebar logout button
    const sidebarLogout = document.getElementById('sidebar-logout-btn');
    if (sidebarLogout) {
        sidebarLogout.addEventListener('click', () => {
            firebase.auth().signOut().then(() => window.location.reload());
        });
    }
}

// ─── Main Init ────────────────────────────────────────────────
async function initComponents() {
    const headerLoaded = await loadComponent('header-container', '/components/header.html');
    const footerLoaded = await loadComponent('footer-container', '/components/footer.html');

    if (headerLoaded) {
        syncCartBadges();

        // Wire legacy header auth (updates desktop profile/login btn)
        if (typeof wireHeaderAuth === 'function') {
            wireHeaderAuth();
        }

        // Wire the new sidebar
        initMobileSidebar();
        wireSidebarAuth();
    }

    // Dispatch event for page-specific initialization
    document.dispatchEvent(new CustomEvent('componentsLoaded'));
}

// Run on DOM content loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComponents);
} else {
    initComponents();
}
