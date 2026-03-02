// ============================================================
//  DEVANSHIK — Firebase Realtime DB Helpers
// ============================================================

async function loadAllProducts() {
    if (window.APP_CACHE && window.APP_CACHE.products) return window.APP_CACHE.products;

    const isAdmin = window.location.pathname.includes('/admin');
    const getCache = window.getCache;
    const saveCache = window.saveCache;

    // Admin should fetch fresh or if cache system missing, bypass
    if (!isAdmin && typeof getCache === 'function') {
        const cached = getCache("products");
        if (cached) {
            window.APP_CACHE.products = cached;

            // Background revalidation
            db.ref("products").once("value").then(snap => {
                const formattedData = {};
                if (snap.exists()) {
                    snap.forEach(child => {
                        const val = child.val();
                        if (val && typeof val === 'object' && val.title) {
                            formattedData[child.key] = { ...val, id: child.key };
                        }
                    });
                }
                window.APP_CACHE.products = formattedData;
                if (typeof saveCache === 'function') saveCache("products", formattedData);
            }).catch(e => console.error(e));

            return cached;
        }
    }

    const snap = await db.ref("products").once("value");
    const formattedData = {};
    if (snap.exists()) {
        snap.forEach(child => {
            const val = child.val();
            if (val && typeof val === 'object' && val.title) {
                formattedData[child.key] = { ...val, id: child.key };
            }
        });
    }

    window.APP_CACHE.products = formattedData;
    if (typeof saveCache === 'function') saveCache("products", formattedData);

    return formattedData;
}

async function getProducts(filters = {}) {
    const productsObj = await loadAllProducts();
    let list = Object.values(productsObj).filter(Boolean);

    // Apply Filters
    let filtered = [...list];
    if (filters.category) filtered = filtered.filter(p => p.category === filters.category);
    if (filters.minPrice) filtered = filtered.filter(p => p.price >= filters.minPrice);
    if (filters.maxPrice) filtered = filtered.filter(p => p.price <= filters.maxPrice);
    if (filters.productType) filtered = filtered.filter(p => p.productType === filters.productType);
    if (filters.sort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
    if (filters.sort === 'price-desc') filtered.sort((a, b) => b.price - a.price);
    if (filters.sort === 'newest') filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (filters.limit && filtered.length > filters.limit) {
        filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
}

async function getProduct(id) {
    const products = await loadAllProducts();
    if (products && products[id]) return products[id];

    // Fallback exactly to firebase if missing
    const snap = await db.ref('products/' + id).once('value');
    return snap.exists() ? { ...snap.val(), id: snap.key } : null;
}

async function writeProduct(data, id = null) {
    if (id) {
        // Edit existing: use update() to preserve fields like createdAt
        data.updatedAt = Date.now();
        await db.ref('products/' + id).update(data);
        return id;
    } else {
        // New product: use push() to create a unique key
        const ref = db.ref('products').push();
        const productData = {
            ...data,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            productType: data.productType || 'physical'
        };
        await ref.set(productData);
        return ref.key;
    }
}

async function deleteProduct(id) {
    return db.ref('products/' + id).remove();
}

// ─── Reviews & Ratings ───────────────────────────────────────
async function getReviews(productId, includeHidden = false, sortType = 'newest') {
    const snap = await db.ref(`reviews/${productId}`).once('value');
    if (!snap.exists()) return [];

    let list = [];
    snap.forEach(child => {
        const val = child.val();
        if (val && typeof val === 'object') {
            // Filter out hidden reviews unless explicitly included
            if (includeHidden || !val.hidden) {
                list.push({ ...val, userId: child.key, id: child.key });
            }
        }
    });

    if (sortType === 'highest') {
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortType === 'lowest') {
        list.sort((a, b) => (a.rating || 0) - (b.rating || 0));
    } else {
        // newest
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    return list;
}

/**
 * Recalculate and update the average rating and review count for a product
 */
async function updateProductRating(productId) {
    const snap = await db.ref(`reviews/${productId}`).once('value');
    if (!snap.exists()) {
        await db.ref(`products/${productId}`).update({
            ratingAverage: 5,
            reviewCount: 0
        });
        return;
    }

    const reviews = Object.values(snap.val())
        .filter(r => r && !r.hidden);

    if (reviews.length === 0) {
        await db.ref(`products/${productId}`).update({
            ratingAverage: 5,
            reviewCount: 0
        });
        return;
    }

    const total = reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
    const avg = total / reviews.length;

    await db.ref(`products/${productId}`).update({
        ratingAverage: Number(avg.toFixed(1)),
        reviewCount: reviews.length,
        totalReviews: reviews.length
    });
}

async function writeReview(productId, reviewData) {
    const { userId, rating, comment, userName, images, verified, hiddenImages } = reviewData;
    if (!userId) throw new Error("User ID is required to write a review.");

    const reviewRef = db.ref(`reviews/${productId}/${userId}`);

    // Prepare update data carefully - only include what's provided to avoid overwriting
    const data = {
        updatedAt: Date.now()
    };

    if (userName !== undefined) data.userName = userName;
    if (rating !== undefined) data.rating = Number(rating);
    if (comment !== undefined) data.comment = comment;
    if (images !== undefined) data.images = images;
    if (verified !== undefined) data.verified = verified;
    if (hiddenImages !== undefined) data.hiddenImages = hiddenImages;

    // Check if new review to set defaults
    const snap = await reviewRef.once('value');
    if (!snap.exists()) {
        data.createdAt = Date.now();
        data.helpful = {};
        data.reports = {};
        data.hidden = false;
        data.hiddenImages = [];
        data.adminReply = null;

        // Ensure required fields for new review
        if (data.userName === undefined) data.userName = "Customer";
        if (data.rating === undefined) data.rating = 5;
        if (data.comment === undefined) data.comment = "";
        if (data.images === undefined) data.images = [];
    }

    await reviewRef.update(data);
    await updateProductRating(productId);
    return userId;
}

async function markHelpful(productId, reviewUserId, currentUserId) {
    if (!currentUserId) return;
    const ref = db.ref(`reviews/${productId}/${reviewUserId}/helpful/${currentUserId}`);
    const snap = await ref.once('value');
    if (snap.exists()) return; // Already marked helpful

    await ref.set(true);
}

async function saveAdminReply(productId, reviewUserId, message) {
    if (!message.trim()) {
        await db.ref(`reviews/${productId}/${reviewUserId}/adminReply`).remove();
    } else {
        await db.ref(`reviews/${productId}/${reviewUserId}/adminReply`).update({
            message: message,
            repliedAt: Date.now()
        });
    }
}

async function hideReview(productId, userId, isHidden) {
    await db.ref(`reviews/${productId}/${userId}`).update({
        hidden: isHidden,
        updatedAt: Date.now()
    });
    await updateProductRating(productId);
}

async function deleteReview(productId, userId) {
    await db.ref(`reviews/${productId}/${userId}`).remove();
    // Also cleanup moderator logs
    await db.ref(`moderationAlerts/${productId}/${userId}`).remove();
    await updateProductRating(productId);
}

async function reportReview(productId, reviewUserId, reporterUserId) {
    if (!reporterUserId) throw new Error("Reporter User ID required.");

    const reportRef = db.ref(`reviews/${productId}/${reviewUserId}/reports/${reporterUserId}`);
    const snap = await reportRef.once('value');
    if (snap.exists()) return; // Already reported

    await reportRef.set(true);
    await checkAutoHide(productId, reviewUserId);
}

async function checkAutoHide(productId, reviewUserId) {
    const snap = await db.ref(`reviews/${productId}/${reviewUserId}/reports`).once('value');
    if (!snap.exists()) return;

    const reports = snap.val();
    const count = Object.keys(reports).length;

    if (count >= 5) {
        await db.ref(`reviews/${productId}/${reviewUserId}/hidden`).set(true);
        // Alert admin
        await db.ref(`moderationAlerts/${productId}/${reviewUserId}`).set({
            reason: 'Auto-hidden due to 5+ reports',
            timestamp: Date.now()
        });
    }
}

async function markHelpful(productId, reviewUserId, userId) {
    if (!userId) return;
    const ref = db.ref(`reviews/${productId}/${reviewUserId}/helpful/${userId}`);
    const snap = await ref.once('value');
    if (snap.exists()) return; // Already marked helpful

    await ref.set(true);
}



async function canUserReview(userId, productId) {
    // Only users who purchased AND have a 'delivered' order can review
    const orders = await getOrders(userId);
    const deliveredOrders = orders.filter(o => {
        const status = (o.orderStatus || '').toLowerCase();
        return status === 'delivered' || status === 'completed';
    });

    // Check if any delivered order contains this product
    const hasPurchased = deliveredOrders.some(order => {
        const items = order.items || order.products || [];
        return items.some(item => item.productId === productId);
    });

    if (!hasPurchased) return false;

    // Return the existing review if they already reviewed, so UI can show "Edit"
    const snap = await db.ref(`reviews/${productId}/${userId}`).once('value');
    if (snap.exists()) {
        return { alreadyReviewed: true, review: snap.val() };
    }

    return { alreadyReviewed: false };
}


// ─── Orders ──────────────────────────────────────────────────
async function writeOrder(orderData) {
    // ─── Safety Check: Recalculate and Validate ──────────────────
    // In a real app, this runs on Cloud Functions. Here we simulate it.
    try {
        const allDiscounts = await getActiveDiscounts();
        const cartItems = orderData.products || orderData.items || [];

        // Re-validate coupon if present
        let validatedCoupon = null;
        if (orderData.discountBreakdown?.appliedCoupon) {
            const couponResult = await validateCouponCode(
                orderData.discountBreakdown.appliedCoupon,
                orderData.userId,
                cartItems.reduce((s, i) => s + i.price * i.qty, 0)
            );
            if (couponResult.valid) validatedCoupon = couponResult.discount;
        }

        const freshBreakdown = buildDiscountBreakdown(cartItems, allDiscounts, validatedCoupon);

        // Verify total amount mismatch (with 1 Re leeway for rounding)
        // Ensure we round the expected total as well to avoid floating point precision issues
        const expectedTotal = Math.round((freshBreakdown.finalTotal + (orderData.shippingCharge || 0) + (orderData.gstAmount || 0)) * 100) / 100;
        if (Math.abs(expectedTotal - orderData.totalAmount) > 1) {
            console.error("Payment Safety Check Failed:", { expected: expectedTotal, received: orderData.totalAmount });
            throw new Error("Order validation failed: Price mismatch. Please refresh your cart and try again.");
        }
    } catch (err) {
        console.error("Order writing failed safety check:", err);
        throw err;
    }

    // Digital product shipping fix
    const isDigital = orderData.orderType === 'digital';
    if (isDigital) {
        orderData.shippingCharge = 0;
    }

    // Generate invoice number (INV-YYYY-XXXXX)
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 90000) + 10000;
    const invoiceNumber = `INV-${year}-${random}`;

    const ref = db.ref('orders').push();
    await ref.set({
        ...orderData,
        orderVersion: 2,
        invoiceNumber,
        createdAt: Date.now()
    });
    return ref.key;
}


async function getOrders(userId = null) {
    const snap = await db.ref('orders').once('value');
    let list = [];
    snap.forEach(child => {
        const val = child.val();
        if (val && typeof val === 'object') {
            list.push({ ...val, id: child.key });
        }
    });
    if (userId) list = list.filter(o => o.userId === userId);
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list;
}

async function getOrder(id) {
    const snap = await db.ref(`orders/${id}`).once('value');
    return snap.exists() ? { ...snap.val(), id: snap.key } : null;
}

async function updateOrderStatus(id, status) {
    return db.ref(`orders/${id}`).update({ orderStatus: status, updatedAt: Date.now() });
}

async function updatePaymentStatus(id, status) {
    return db.ref(`orders/${id}`).update({ paymentStatus: status, updatedAt: Date.now() });
}

// ─── Banners ──────────────────────────────────────────────────
let bannerCache = null;

async function getBanners() {
    const cacheKey = 'bannersCache';
    if (bannerCache) return [...bannerCache];

    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
                bannerCache = parsed.data;
                return [...bannerCache];
            }
        } catch (e) { }
    }

    const snap = await db.ref('banners').once('value');
    const list = [];
    snap.forEach(child => {
        const val = child.val();
        if (val && typeof val === 'object') {
            list.push({ ...val, id: child.key });
        }
    });

    bannerCache = list;
    localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data: bannerCache
    }));

    return [...bannerCache];
}

async function getActiveBanners() {
    const all = await getBanners();
    return all.filter(b => b.isActive === true);
}

async function writeBanner(data, id = null) {
    if (id) {
        // Edit existing — preserve createdAt
        await db.ref(`banners/${id}`).update({ ...data, updatedAt: Date.now() });
        return id;
    } else {
        const ref = db.ref('banners').push();
        await ref.set({ ...data, createdAt: Date.now() });
        return ref.key;
    }
}

async function toggleBannerActive(id, isActive) {
    return db.ref(`banners/${id}`).update({ isActive });
}

async function deleteBanner(id) {
    return db.ref(`banners/${id}`).remove();
}

// ─── Users ────────────────────────────────────────────────────
async function getUsers() {
    const snap = await db.ref('users').once('value');
    if (!snap.exists()) return [];
    const list = [];
    snap.forEach(child => {
        const val = child.val();
        if (val && typeof val === 'object') {
            list.push({ ...val, id: child.key, uid: child.key });
        }
    });
    return list;
}

async function getUser(uid) {
    const snap = await db.ref(`users/${uid}`).once('value');
    return snap.exists() ? { ...snap.val(), id: snap.key } : null;
}

async function updateUserProfile(uid, data) {
    return db.ref(`users/${uid}`).update(data);
}

async function updateUserRole(uid, role) {
    return db.ref(`users/${uid}/role`).set(role);
}

// ─── Wishlist ────────────────────────────────────────────────
async function toggleWishlist(uid, productId) {
    const ref = db.ref(`users/${uid}/wishlist/${productId}`);
    const snap = await ref.once('value');
    if (snap.exists()) {
        await ref.remove();
        return false; // Removed
    } else {
        await ref.set(true);
        return true; // Added
    }
}

async function getWishlist(uid) {
    const snap = await db.ref(`users/${uid}/wishlist`).once('value');
    if (!snap.exists()) return [];
    return Object.keys(snap.val());
}

// ─── Landing Page CMS ────────────────────────────────────────

async function getLandingPage() {
    const snap = await db.ref('landingPage').once('value');
    return snap.exists() ? snap.val() : {};
}

async function saveLandingSection(section, data) {
    await db.ref(`landingPage/${section}`).update(data);
}

// Hero Banners (under landingPage/hero/banners)
async function getLandingBanners() {
    const snap = await db.ref('landingPage/hero/banners').once('value');
    if (!snap.exists()) return [];
    const list = [];
    snap.forEach(child => {
        const val = child.val();
        if (val && typeof val === 'object') list.push({ ...val, id: child.key });
    });
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
    return list;
}

async function writeLandingBanner(data, id = null) {
    if (id) {
        await db.ref(`landingPage/hero/banners/${id}`).update({ ...data, updatedAt: Date.now() });
        await db.ref(`landingPage/hero`).update({ lastUpdated: Date.now() });
        return id;
    } else {
        const ref = db.ref('landingPage/hero/banners').push();
        await ref.set({ ...data, createdAt: Date.now() });
        await db.ref(`landingPage/hero`).update({ lastUpdated: Date.now() });
        return ref.key;
    }
}

async function deleteLandingBanner(id) {
    await db.ref(`landingPage/hero/banners/${id}`).remove();
    return db.ref(`landingPage/hero`).update({ lastUpdated: Date.now() });
}

async function toggleLandingBanner(id, enabled) {
    await db.ref(`landingPage/hero/banners/${id}`).update({ enabled });
    return db.ref(`landingPage/hero`).update({ lastUpdated: Date.now() });
}

// Categories (under landingPage/categories/items)
async function getLandingCategories() {
    const snap = await db.ref('landingPage/categories/items').once('value');
    if (!snap.exists()) return [];
    const list = [];
    snap.forEach(child => {
        const val = child.val();
        if (val && typeof val === 'object') list.push({ ...val, id: child.key });
    });
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
    return list;
}

async function writeLandingCategory(data, id = null) {
    if (id) {
        await db.ref(`landingPage/categories/items/${id}`).update({ ...data, updatedAt: Date.now() });
        return id;
    } else {
        const ref = db.ref('landingPage/categories/items').push();
        await ref.set({ ...data, createdAt: Date.now() });
        return ref.key;
    }
}

async function deleteLandingCategory(id) {
    return db.ref(`landingPage/categories/items/${id}`).remove();
}

// Testimonials (under landingPage/testimonials/items)
async function getLandingTestimonials() {
    const snap = await db.ref('landingPage/testimonials/items').once('value');
    if (!snap.exists()) return [];
    const list = [];
    snap.forEach(child => {
        const val = child.val();
        if (val && typeof val === 'object') list.push({ ...val, id: child.key });
    });
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
    return list;
}

async function writeLandingTestimonial(data, id = null) {
    if (id) {
        await db.ref(`landingPage/testimonials/items/${id}`).update({ ...data, updatedAt: Date.now() });
        return id;
    } else {
        const ref = db.ref('landingPage/testimonials/items').push();
        await ref.set({ ...data, createdAt: Date.now() });
        return ref.key;
    }
}

async function deleteLandingTestimonial(id) {
    return db.ref(`landingPage/testimonials/items/${id}`).remove();
}

// Featured Products
async function getLandingFeatured() {
    const snap = await db.ref('landingPage/featured').once('value');
    return snap.exists() ? snap.val() : null;
}

async function saveLandingFeatured(data) {
    return db.ref('landingPage/featured').update({ ...data, updatedAt: Date.now() });
}

// Site Theme (pageHeroes + festival themes)
async function getSiteTheme() {
    const snap = await db.ref('siteTheme').once('value');
    return snap.exists() ? snap.val() : {};
}

async function savePageHero(page, data) {
    return db.ref(`siteTheme/pageHeroes/${page}`).update(data);
}

async function saveFestivalTheme(themeName, data) {
    return db.ref(`siteTheme/themes/${themeName}`).update(data);
}

async function setActiveTheme(themeName) {
    return db.ref('siteTheme').update({ activeTheme: themeName });
}

// ─── Dashboard stats ──────────────────────────────────────────
async function getDashboardStats() {
    const [ordersSnap, usersSnap, productsSnap] = await Promise.all([
        db.ref('orders').once('value'),
        db.ref('users').once('value'),
        db.ref('products').once('value')
    ]);

    let totalRevenue = 0, totalOrders = 0;
    let digitalOrders = 0, physicalOrders = 0;
    let digitalProducts = 0, physicalProducts = 0;
    let pendingOrders = 0;

    ordersSnap.forEach(c => {
        const o = c.val();
        if (!o || typeof o !== 'object') return;
        totalRevenue += (o.totalAmount || 0);
        totalOrders++;
        if ((o.orderStatus || 'pending').toLowerCase() === 'pending') pendingOrders++;
        if (o.orderType === 'digital') digitalOrders++;
        else physicalOrders++;
    });

    productsSnap.forEach(c => {
        const p = c.val();
        if (!p || typeof p !== 'object' || !p.title) return;
        if (p.productType === 'digital') digitalProducts++;
        else physicalProducts++;
    });

    return {
        totalOrders,
        totalUsers: usersSnap.numChildren(),
        totalRevenue,
        pendingOrders,
        digitalOrders,
        physicalOrders,
        digitalProducts,
        physicalProducts,
        totalProducts: digitalProducts + physicalProducts
    };
}

// ─── Discounts & Coupons ─────────────────────────────────────

async function writeDiscount(data, id = null) {
    if (id) {
        data.updatedAt = Date.now();
        await db.ref(`discounts/${id}`).update(data);
        return id;
    } else {
        const ref = db.ref('discounts').push();
        await ref.set({ ...data, createdAt: Date.now(), updatedAt: Date.now() });
        return ref.key;
    }
}

async function getDiscounts() {
    const snap = await db.ref('discounts').once('value');
    if (!snap.exists()) return [];
    const list = [];
    snap.forEach(child => {
        const val = child.val();
        if (val && typeof val === 'object') list.push({ ...val, id: child.key });
    });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list;
}

async function getActiveDiscounts() {
    const all = await getDiscounts();
    const now = Date.now();
    return all.filter(d => {
        if (!d.active) return false;
        if (d.startDate && now < d.startDate) return false;
        if (d.endDate && now > d.endDate) return false;
        return true;
    });
}

async function deleteDiscount(id) {
    return db.ref(`discounts/${id}`).remove();
}

async function toggleDiscountActive(id, active) {
    return db.ref(`discounts/${id}`).update({ active, updatedAt: Date.now() });
}

/**
 * Validates a coupon code for a given user and cart subtotal.
 * Returns { valid: bool, discount: obj|null, error: string|null }
 */
async function validateCouponCode(code, userId, cartSubtotal) {
    if (!code || !code.trim()) return { valid: false, error: 'Please enter a coupon code.' };

    const all = await getDiscounts();
    const now = Date.now();

    const discount = all.find(d =>
        d.type === 'coupon' &&
        d.couponCode && d.couponCode.toUpperCase() === code.trim().toUpperCase()
    );

    if (!discount) return { valid: false, error: 'Invalid coupon code.' };
    if (!discount.active) return { valid: false, error: 'This coupon is no longer active.' };
    if (discount.startDate && now < discount.startDate) return { valid: false, error: 'This coupon is not yet active.' };
    if (discount.endDate && now > discount.endDate) return { valid: false, error: 'This coupon has expired.' };
    if (discount.minOrder && cartSubtotal < discount.minOrder) {
        return { valid: false, error: `Minimum order of ₹${discount.minOrder} required for this coupon.` };
    }

    // Check global usage limit
    if (discount.usageLimit) {
        const usageSnap = await db.ref(`couponUsage/${discount.couponCode.toUpperCase()}/totalUsed`).once('value');
        const used = usageSnap.exists() ? (usageSnap.val() || 0) : 0;
        if (used >= discount.usageLimit) return { valid: false, error: 'This coupon has reached its usage limit.' };
    }

    // Check per-user usage limit
    if (discount.perUserLimit && userId) {
        const userSnap = await db.ref(`couponUsage/${discount.couponCode.toUpperCase()}/users/${userId}`).once('value');
        const userUsed = userSnap.exists() ? (userSnap.val() || 0) : 0;
        if (userUsed >= discount.perUserLimit) return { valid: false, error: 'You have already used this coupon.' };
    }

    return { valid: true, discount, error: null };
}

async function recordCouponUsage(couponCode, userId) {
    if (!couponCode) return;
    const key = couponCode.toUpperCase();
    const usageRef = db.ref(`couponUsage/${key}`);
    // Increment totalUsed
    const snap = await usageRef.once('value');
    const current = snap.exists() ? (snap.val().totalUsed || 0) : 0;
    const updates = { totalUsed: current + 1 };
    if (userId) {
        const userSnap = await db.ref(`couponUsage/${key}/users/${userId}`).once('value');
        updates[`users/${userId}`] = (userSnap.exists() ? (userSnap.val() || 0) : 0) + 1;
    }
    return usageRef.update(updates);
}

async function getCouponUsage(couponCode) {
    if (!couponCode) return { totalUsed: 0, users: {} };
    const snap = await db.ref(`couponUsage/${couponCode.toUpperCase()}`).once('value');
    return snap.exists() ? snap.val() : { totalUsed: 0, users: {} };
}
