// ============================================================
//  DEVANSHIK — Shared Utilities
// ============================================================

window.APP_CACHE = {
    user: null,
    products: null,
    banners: null,
    cart: null,
    addresses: null,
};

// ─── Toast Notifications ─────────────────────────────────────
function showToast(message, type = 'default', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const icons = { success: '✓', error: '✕', warning: '⚠', default: 'ℹ' };
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || icons.default}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

// ─── Currency Formatting ──────────────────────────────────────
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

// ─── Date Formatting ──────────────────────────────────────────
function formatDate(timestamp) {
    if (!timestamp) return '—';
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}
function formatDateShort(timestamp) {
    if (!timestamp) return '—';
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(timestamp));
}

// ─── Order ID generator ───────────────────────────────────────
function shortOrderId(firebaseKey) {
    return '#' + firebaseKey.slice(-6).toUpperCase();
}

// ─── Order Status Badge ───────────────────────────────────────
function statusBadge(status) {
    const s = (status || 'pending').toLowerCase();
    return `<span class="badge badge-${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</span>`;
}

// ─── Confirm Dialog ───────────────────────────────────────────
function confirmDialog(message) {
    return new Promise(resolve => resolve(window.confirm(message)));
}

// ─── Debounce ─────────────────────────────────────────────────
function debounce(fn, delay = 300) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ─── URL Params ───────────────────────────────────────────────
function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

// ─── Sticky header scroll shadow ─────────────────────────────
function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

// ─── Mobile nav toggle ────────────────────────────────────────
function initMobileNav() {
    const hamburger = document.querySelector('.hamburger');
    const mobileNav = document.querySelector('.mobile-nav');
    if (!hamburger || !mobileNav) return;
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        mobileNav.classList.toggle('open');
        document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';
    });
    mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileNav.classList.remove('open');
        document.body.style.overflow = '';
    }));
}

// ─── Active nav link ──────────────────────────────────────────
function markActiveNav() {
    document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(a => {
        if (a.href === window.location.href) a.classList.add('active');
    });
}

// ─── Loading overlay ──────────────────────────────────────────
function showPageLoader() {
    const el = document.getElementById('page-loader');
    if (el) el.classList.remove('hidden');
}
function hidePageLoader() {
    const el = document.getElementById('page-loader');
    if (el) el.classList.add('hidden');
}

// ─── Instant UX & Prefetching ──────────────────────────────────

// Instantly hide login icon if user is cached
(function () {
    const cachedUser = window.getCache('user_profile');
    if (cachedUser) {
        document.addEventListener('DOMContentLoaded', () => {
            const loginIcon = document.getElementById("login-icon");
            if (loginIcon) loginIcon.style.display = "none";
        });
        // Also check if it's already in the DOM (e.g. injected header)
        const observer = new MutationObserver(() => {
            const loginIcon = document.getElementById("login-icon");
            if (loginIcon) {
                loginIcon.style.display = "none";
                observer.disconnect();
            }
        });
        observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    }
})();

// Prefetch products on hover
document.addEventListener('mouseover', (e) => {
    const card = e.target.closest('.product-card');
    if (card && !card.dataset.prefetched) {
        card.dataset.prefetched = "true";
        if (typeof loadAllProducts === 'function') {
            loadAllProducts(); // Triggers cache check and silent background sync
        }
    }
}, { passive: true });

// ─── XSS Prevention ───────────────────────────────────────────
/**
 * Escape user-supplied content before injecting into innerHTML.
 * Always use this when rendering data from Firebase / user input.
 */
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/** Shorthand — same as escapeHtml, use when building template strings */
const safeText = escapeHtml;

// ─── Input Validation ─────────────────────────────────────────
/**
 * Validate product form data before saving to Firebase.
 * Returns { valid: boolean, errors: string[] }
 */
function validateProductInput({ title, price, stock, description }) {
    const errors = [];
    if (!title || title.trim().length < 2) errors.push('Product title must be at least 2 characters.');
    if (!title || title.trim().length > 120) errors.push('Product title must be under 120 characters.');
    if (isNaN(price) || price <= 0) errors.push('Price must be a positive number.');
    if (price > 1000000) errors.push('Price seems unrealistically high.');
    if (isNaN(stock) || stock < 0) errors.push('Stock must be 0 or more.');
    if (description && description.length > 2000) errors.push('Description must be under 2000 characters.');
    return { valid: errors.length === 0, errors };
}

/**
 * Validate address form fields.
 * Returns { valid: boolean, errors: string[] }
 */
function validateAddress({ name, phone, line1, city, state, pin }) {
    const errors = [];
    if (!name || name.trim().length < 2) errors.push('Full name is required.');
    if (!phone || !/^[0-9]{10}$/.test(phone.trim()))
        errors.push('Enter a valid 10-digit phone number.');
    if (!line1 || line1.trim().length < 5) errors.push('Address line 1 is required (min 5 chars).');
    if (!city || city.trim().length < 2) errors.push('City is required.');
    if (!state || state.trim().length < 2) errors.push('State is required.');
    if (!pin || !/^[0-9]{6}$/.test(pin.trim()))
        errors.push('Enter a valid 6-digit pincode.');
    return { valid: errors.length === 0, errors };
}

// ─── Unified Product Card Component ──────────────────────────
const WISHLIST_KEY = 'devanshik_wishlist';

/** Get wishlist from localStorage */
function getWishlistLocal() {
    try { return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; }
    catch { return []; }
}

/** Save wishlist to localStorage and notify UI */
function saveWishlistLocal(list) {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
    document.dispatchEvent(new Event('wishlistUpdated'));
}

/** Sync all wishlist icons on the page */
function syncWishlistUI() {
    const list = getWishlistLocal();
    document.querySelectorAll('.wishlist-btn, .detail-wishlist').forEach(btn => {
        const id = btn.dataset.productId;
        if (id) {
            const active = list.includes(id);
            btn.classList.toggle('active', active);
            btn.title = active ? 'Remove from Wishlist' : 'Add to Wishlist';
        }
    });
}

/** Initialize wishlist from Firebase into localStorage */
async function initWishlistPersistence(uid) {
    if (!uid) { saveWishlistLocal([]); return; }
    try {
        const cloudList = await getWishlist(uid);
        saveWishlistLocal(cloudList);
    } catch (err) {
        console.error("Failed to init wishlist cache:", err);
    }
}

/**
 * Simple star renderer
 * @param {number} rating - Average rating (0-5)
 * @returns {string} - HTML stars
 */
function renderStars(rating) {
    let stars = '';
    const r = Math.round(rating || 5);
    for (let i = 1; i <= 5; i++) {
        stars += `<span class="star ${i <= r ? 'filled' : ''}">★</span>`;
    }
    return stars;
}

/**
 * Renders a standard product card HTML string.
 * @param {Object} p - Product data object
 * @returns {string} - HTML markup
 */
function renderProductCard(p) {
    const img = p.imageUrl || `https://placehold.co/400x400/F4EFE9/C17B3A?text=${encodeURIComponent(p.title || 'Product')}`;
    const currentPrice = p.discountPrice || p.price;

    // Compute discount percentage for badge
    const hasDiscount = p.discountPrice && p.discountPrice < p.price;
    const discountPct = hasDiscount ? Math.round((1 - p.discountPrice / p.price) * 100) : 0;
    const savingsAmt = hasDiscount ? Math.round(p.price - p.discountPrice) : 0;

    // Discount badge overlay (top-left of image)
    const discountBadge = hasDiscount
        ? `<div class="discount-badge-overlay">${discountPct}% OFF</div>`
        : '';

    // Price block — dominant discounted price
    const priceHtml = hasDiscount
        ? `<div class="product-price-row">
            <span class="price-current-sale">${formatCurrency(p.discountPrice)}</span>
            <span class="price-original-sale">${formatCurrency(p.price)}</span>
           </div>
           <span class="price-save-text">Save ${formatCurrency(savingsAmt)}</span>`
        : `<div class="product-price-row"><span class="price-current">${formatCurrency(p.price)}</span></div>`;

    const isDigital = p.productType === 'digital';
    const typeBadge = `<span class="product-type-badge ${isDigital ? 'digital' : 'physical'}">${isDigital ? '⚡ Digital' : '📦 Physical'}</span>`;

    const list = getWishlistLocal();
    const inWishlist = list.includes(p.id);

    // Ratings Display (harmonized with detail page)
    const revCount = p.totalReviews || p.reviewCount || 0;
    const avgRating = revCount > 0 ? (p.ratingAverage || 0) : 5;

    return `
    <div class="product-card">
        <div class="product-image-wrapper">
            <div class="product-image-box">
                <a href="/product/?id=${p.id}" style="display:block; width:100%; height:100%;">
                    <img src="${img}" alt="${escapeHtml(p.title)}" loading="lazy">
                </a>
            </div>
            ${discountBadge}
            <button class="wishlist-btn ${inWishlist ? 'active' : ''}" 
                    title="${inWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}" 
                    data-product-id="${p.id}"
                    onclick="handleGlobalWishlist(event, '${p.id}')">
                <span class="icon icon-wishlist"></span>
            </button>
        </div>
        <div class="product-content">
            <div class="product-card-header">
                <span class="product-category">${escapeHtml(p.category || 'Product')}</span>
                ${typeBadge}
            </div>
            <a href="/product/?id=${p.id}" class="product-title" title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</a>
            
            <div class="product-rating">
                <span class="rating-avg">${avgRating > 0 ? avgRating.toFixed(1) : '5.0'}</span>
                ${renderStars(avgRating)}
            </div>

            ${priceHtml}
            <button class="add-cart-btn" onclick="handleGlobalAddToCart(event, '${p.id}', '${escapeHtml(p.title)}', ${currentPrice}, '${img}', '${p.productType || 'physical'}', '${(p.downloadFiles || []).join(',')}')">Add to Cart</button>
        </div>
    </div>`;
}


/** Global event handler for wishlist toggle */
async function handleGlobalWishlist(e, id) {
    e.preventDefault(); e.stopPropagation();
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) { showToast('Please sign in to add items to your wishlist', 'error'); return; }

    const list = getWishlistLocal();
    const isActive = list.includes(id);
    let newList = isActive ? list.filter(item => item !== id) : [...list, id];

    // Optimistic UI Update
    saveWishlistLocal(newList);

    try {
        const added = await toggleWishlist(currentUser.uid, id);
        // Toast feedback
        showToast(added ? 'Sacred item added to wishlist 🙏' : 'Item removed from wishlist', 'success');

        // Final sync check (optional, but keeps state robust if toggle fails)
        if (added !== !isActive) {
            const verifiedList = await getWishlist(currentUser.uid);
            saveWishlistLocal(verifiedList);
        }
    } catch (err) {
        // Revert on error
        saveWishlistLocal(list);
        showToast('Could not update wishlist.', 'error');
    }
}

/** Global event handler for quick add to cart */
function handleGlobalAddToCart(e, id, title, price, img, productType, downloadFiles) {
    e.stopPropagation();
    // Block duplicate digital adds before calling addToCart
    if (productType === 'digital' && typeof getCart === 'function') {
        const alreadyInCart = getCart().some(i => i.productId === id);
        if (alreadyInCart) {
            showToast('Already in cart ⚡', 'warning');
            return;
        }
    }
    if (typeof addToCart === 'function') {
        addToCart({
            productId: id,
            title,
            price,
            imageUrl: img,
            qty: 1,
            productType: productType || 'physical',
            downloadFiles: downloadFiles ? downloadFiles.split(',') : []
        });
    }
}

// ─── Shared page init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initHeaderScroll();
    initMobileNav();
    markActiveNav();
    syncWishlistUI();
});

// Listen for global wishlist updates
document.addEventListener('wishlistUpdated', syncWishlistUI);

// ─── Preload Product Detail On Hover ──────────────────────────
function preloadProduct(productId) {
    if (!window.APP_CACHE.products || !window.APP_CACHE.products[productId]) {
        // Silently fetch to cache
        if (typeof firebase !== 'undefined') {
            firebase.database().ref(`products/${productId}`).once("value").then(snap => {
                const data = snap.val();
                if (data) {
                    if (!window.APP_CACHE.products) window.APP_CACHE.products = {};
                    window.APP_CACHE.products[productId] = { ...data, id: productId };
                    localStorage.setItem("products_cache", JSON.stringify(window.APP_CACHE.products));
                }
            }).catch(err => { });
        }
    }
}

document.addEventListener('mouseover', (e) => {
    const card = e.target.closest('.product-card');
    if (card) {
        const btn = card.querySelector('.wishlist-btn');
        if (btn && btn.dataset.productId) {
            preloadProduct(btn.dataset.productId);
        }
    }
}, { passive: true });

// ─── Smart Fuzzy Search Engine ────────────────────────────────

/** In-memory search index built once from cached products */
let SEARCH_INDEX = [];

/**
 * Build the search index from the products cache.
 * Safe to call multiple times — merges any new products in.
 */
async function buildSearchIndex() {
    let productsObj = {};
    if (window.APP_CACHE && window.APP_CACHE.products) {
        productsObj = window.APP_CACHE.products;
    } else if (typeof loadAllProducts === 'function') {
        productsObj = await loadAllProducts();
    }
    SEARCH_INDEX = Object.values(productsObj)
        .filter(Boolean)
        .map(p => ({
            id: p.id,
            name: p.title || p.name || '',
            category: p.category || '',
            description: p.description || '',
            price: p.discountPrice || p.price || 0,
            imageUrl: p.imageUrl || '',
            text: `${p.title || p.name || ''} ${p.category || ''} ${p.description || ''}`.toLowerCase()
        }));
}

/**
 * Character-overlap similarity score between two strings.
 * Returns 0.0 (no match) – 1.0 (perfect overlap).
 */
function similarity(a, b) {
    if (!a || !b) return 0;
    let matches = 0;
    for (const char of a) {
        if (b.includes(char)) matches++;
    }
    return matches / Math.max(a.length, b.length);
}

/**
 * Smart search with fuzzy scoring.
 * Direct substring matches score 1.0; everything else gets a fuzzy score.
 * Returns top results above threshold, sorted by score desc.
 */
function smartSearch(query, limit = 8) {
    if (!query || !SEARCH_INDEX.length) return [];
    const q = query.toLowerCase().trim();

    const scored = SEARCH_INDEX.map(product => {
        const directMatch = product.text.includes(q);
        // Also check each word in the query individually for partial direct hits
        const wordMatch = q.split(/\s+/).some(word => product.text.includes(word));
        const fuzzyScore = similarity(q, product.text);
        const score = directMatch ? 1 : (wordMatch ? 0.85 : fuzzyScore);
        return { ...product, score, directMatch };
    });

    return scored
        .filter(p => p.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

/**
 * Wrap matching query text in <mark> tags for visual highlighting.
 * Safe — only modifies matched substrings.
 */
function highlightMatch(text, query) {
    if (!query || !text) return escapeHtml(text);
    const safe = escapeHtml(text);
    const safeQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(`(${safeQuery})`, 'gi'), '<mark>$1</mark>');
}

// ─── Global Search Overlay ────────────────────────────────────

function initGlobalSearch() {
    const searchBtn = document.getElementById('header-search-btn');
    const searchOverlay = document.getElementById('global-search-overlay');
    const closeBtn = document.getElementById('search-close-btn');
    const backdrop = document.getElementById('search-overlay-backdrop');
    const input = document.getElementById('global-search-input');
    const resultsContainer = document.getElementById('global-search-results');

    if (!searchBtn || !searchOverlay || !input) return;

    const openSearch = async () => {
        searchOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => input.focus(), 100);
        // Eagerly build index on first open
        if (!SEARCH_INDEX.length) await buildSearchIndex();
    };

    const closeSearch = () => {
        searchOverlay.classList.remove('active');
        document.body.style.overflow = '';
        input.value = '';
        resultsContainer.innerHTML = '';
    };

    searchBtn.addEventListener('click', openSearch);
    if (closeBtn) closeBtn.addEventListener('click', closeSearch);
    if (backdrop) backdrop.addEventListener('click', closeSearch);

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchOverlay.classList.contains('active')) closeSearch();
    });

    // Handle Enter key → redirect to shop
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = input.value.trim();
            if (query) window.location.href = `/shop/?search=${encodeURIComponent(query)}`;
        }
    });

    // Live search while typing
    input.addEventListener('input', debounce(async function () {
        const raw = this.value.trim();
        const query = raw.toLowerCase();

        if (!query) {
            resultsContainer.innerHTML = '';
            return;
        }

        // Ensure index is ready
        if (!SEARCH_INDEX.length) {
            resultsContainer.innerHTML = '<div class="search-empty"><div class="spinner" style="width:24px;height:24px;border-width:2px;margin:auto;border-top-color:var(--color-primary);"></div></div>';
            await buildSearchIndex();
        }

        const results = smartSearch(query, 8);

        if (!results.length) {
            resultsContainer.innerHTML = `
                <div class="search-empty">
                    <span class="icon icon-search" style="font-size:32px; opacity:0.3;"></span>
                    <p>No products found for "<strong>${escapeHtml(raw)}</strong>"</p>
                </div>`;
            return;
        }

        // "Did you mean?" — shown when top result has no direct match but good fuzzy score
        const top = results[0];
        const didYouMean = (!top.directMatch && top.score > 0.5)
            ? `<div class="did-you-mean">✦ Did you mean: <a href="/product/?id=${top.id}">${escapeHtml(top.name)}</a>?</div>`
            : '';

        const items = results.slice(0, 5).map(p => {
            const img = p.imageUrl || `https://placehold.co/400x400/F4EFE9/C17B3A?text=${encodeURIComponent(p.name || 'Product')}`;
            return `
                <a href="/product/?id=${p.id}" class="search-item">
                    <img src="${img}" class="search-item-img" alt="">
                    <div class="search-item-info">
                        <span class="search-item-title">${highlightMatch(p.name, raw)}</span>
                        <span class="search-item-category">${escapeHtml(p.category)}</span>
                    </div>
                    <span class="search-item-price">${formatCurrency(p.price)}</span>
                </a>`;
        }).join('');

        const viewAll = results.length >= 5
            ? `<a href="/shop/?search=${encodeURIComponent(raw)}" class="btn btn-outline w-full" style="margin-top:8px;text-align:center;justify-content:center;">
                    View all results for "${escapeHtml(raw)}" →
               </a>`
            : '';

        resultsContainer.innerHTML = didYouMean + items + viewAll;

    }, 250));
}

document.addEventListener('componentsLoaded', async () => {
    initGlobalSearch();
    // Pre-build index quietly in the background after components load
    if (typeof loadAllProducts === 'function') {
        loadAllProducts().then(() => buildSearchIndex()).catch(() => { });
    }
});
