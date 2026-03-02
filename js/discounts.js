// ============================================================
//  DEVANSHIK — Discount Engine (Client-side Calculation)
//  Pure calculation module: no DOM, no Firebase calls.
//  All functions are synchronous and operate on pre-fetched data.
// ============================================================

/**
 * Given a productId and all active discounts, returns the best
 * product-level or flash-sale discount for that product.
 * @returns {Object|null}
 */
function getActiveProductDiscount(productId, allDiscounts) {
    const now = Date.now();
    const candidates = allDiscounts.filter(d => {
        if (!d.active) return false;
        if (d.startDate && now < d.startDate) return false;
        if (d.endDate && now > d.endDate) return false;
        return (d.type === 'product_sale' || d.type === 'flash_sale') && d.productId === productId;
    });
    if (!candidates.length) return null;
    // Prefer flash_sale over product_sale; if tie, pick highest value
    candidates.sort((a, b) => {
        if (a.type === 'flash_sale' && b.type !== 'flash_sale') return -1;
        if (b.type === 'flash_sale' && a.type !== 'flash_sale') return 1;
        return (b.value || 0) - (a.value || 0);
    });
    return candidates[0];
}

/**
 * Computes the discounted price for a single product given its discount.
 * @param {number} originalPrice
 * @param {Object} discount
 * @returns {number} discounted price (never below 0)
 */
function computeDiscountedPrice(originalPrice, discount) {
    if (!discount) return originalPrice;
    let final = originalPrice;
    if (discount.discountType === 'percentage') {
        const pct = Math.min(discount.value || 0, 100);
        final = originalPrice * (1 - pct / 100);
        if (discount.cap) final = Math.max(final, originalPrice - discount.cap);
    } else if (discount.discountType === 'fixed') {
        final = originalPrice - (discount.value || 0);
    }
    return Math.max(0, Math.round(final * 100) / 100);
}

/**
 * Compute savings amount for one item given its discount.
 */
function computeItemSavings(originalPrice, discount) {
    if (!discount) return 0;
    return Math.max(0, originalPrice - computeDiscountedPrice(originalPrice, discount));
}

/**
 * Apply product-level discounts to all cart items.
 * Returns a new array with `discountedPrice`, `activeDiscount`, `savings` added.
 * @param {Array} cartItems  — each item: { productId, price, qty, ... }
 * @param {Array} allDiscounts
 * @returns {Array}
 */
function applyProductDiscounts(cartItems, allDiscounts) {
    return cartItems.map(item => {
        const discount = getActiveProductDiscount(item.productId, allDiscounts);
        const discountedPrice = computeDiscountedPrice(item.price, discount);
        const itemSavings = computeItemSavings(item.price, discount);
        const totalSavings = itemSavings * (item.qty || 1);

        return {
            ...item,
            originalPrice: item.price,
            finalPrice: discountedPrice,
            discountApplied: itemSavings,
            discountIds: discount ? [discount.id] : [],
            discountedPrice,
            activeDiscount: discount || null,
            savings: totalSavings
        };
    });
}

/**
 * Find the best minimum-order discount given a subtotal.
 * @param {number} subtotal  (after product discounts)
 * @param {Array} allDiscounts
 * @returns {Object|null}
 */
function getMinOrderDiscount(subtotal, allDiscounts) {
    const now = Date.now();
    const candidates = allDiscounts.filter(d => {
        if (!d.active) return false;
        if (d.type !== 'min_order') return false;
        if (d.startDate && now < d.startDate) return false;
        if (d.endDate && now > d.endDate) return false;
        if (d.minOrder && subtotal < d.minOrder) return false;
        return true;
    });
    if (!candidates.length) return null;
    // Return the one with the highest savings
    candidates.sort((a, b) => {
        const aVal = a.discountType === 'percentage' ? (subtotal * (a.value || 0) / 100) : (a.value || 0);
        const bVal = b.discountType === 'percentage' ? (subtotal * (b.value || 0) / 100) : (b.value || 0);
        return bVal - aVal;
    });
    return candidates[0];
}

/**
 * Compute the savings amount from a min-order discount.
 */
function computeMinOrderSavings(subtotal, discount) {
    if (!discount) return 0;
    if (discount.discountType === 'percentage') {
        return Math.round(subtotal * (discount.value || 0) / 100 * 100) / 100;
    }
    return Math.min(discount.value || 0, subtotal);
}

/**
 * Compute coupon savings for validated coupon discount.
 * @param {number} subtotal  (after product discounts)
 * @param {Object} couponDiscount  — the validated discount object
 * @returns {number} coupon savings amount
 */
function computeCouponSavings(subtotal, couponDiscount) {
    if (!couponDiscount) return 0;
    if (couponDiscount.discountType === 'free_shipping') return 0; // handled as shipping = 0
    if (couponDiscount.discountType === 'percentage') {
        let savings = subtotal * (couponDiscount.value || 0) / 100;
        if (couponDiscount.cap) savings = Math.min(savings, couponDiscount.cap);
        return Math.round(savings * 100) / 100;
    }
    if (couponDiscount.discountType === 'fixed') {
        return Math.min(couponDiscount.value || 0, subtotal);
    }
    return 0;
}

/**
 * Check if coupon gives free shipping.
 */
function isFreeShippingCoupon(couponDiscount) {
    return couponDiscount && couponDiscount.discountType === 'free_shipping';
}

/**
 * Master discount pipeline. Call this to get the full breakdown.
 *
 * @param {Array}  cartItems      — raw cart items { productId, price, qty, ... }
 * @param {Array}  allDiscounts   — fetched from getActiveDiscounts()
 * @param {Object|null} couponDiscount — validated coupon discount object (or null)
 * @returns {Object} {
 *   enrichedItems,     — cart items with discountedPrice/savings
 *   rawSubtotal,       — sum of item.price * qty (no discounts)
 *   productSavings,    — total saved via product-level discounts
 *   discountedSubtotal,— subtotal after product discounts
 *   minOrderDiscount,  — the min-order discount object (or null)
 *   minOrderSavings,   — savings from min-order discount
 *   couponSavings,     — savings from coupon
 *   freeShipping,      — boolean
 *   totalSavings,      — sum of all savings
 *   finalSubtotal,     — the amount to charge (before shipping + tax)
 *   breakdown,         — array of { label, amount } for display
 * }
 */
function buildDiscountBreakdown(cartItems, allDiscounts, couponDiscount = null) {
    // Step 1: Apply product+flash discounts
    const enrichedItems = applyProductDiscounts(cartItems, allDiscounts);
    const rawSubtotal = cartItems.reduce((s, i) => s + i.price * (i.qty || 1), 0);
    const productSavings = enrichedItems.reduce((s, i) => s + (i.savings || 0), 0);
    const discountedSubtotal = rawSubtotal - productSavings;

    // Step 2: Min-order discount (BOGO or general min-order)
    const minOrderDiscount = getMinOrderDiscount(discountedSubtotal, allDiscounts);
    const minOrderSavings = computeMinOrderSavings(discountedSubtotal, minOrderDiscount);

    // Step 3: Coupon
    const couponBase = discountedSubtotal - minOrderSavings;
    const couponSavings = computeCouponSavings(couponBase, couponDiscount);
    const freeShipping = isFreeShippingCoupon(couponDiscount);

    const totalSavings = productSavings + minOrderSavings + couponSavings;
    const finalSubtotal = Math.max(0, rawSubtotal - totalSavings);

    // Build readable breakdown
    const breakdown = [];
    if (productSavings > 0) {
        breakdown.push({ label: 'Product Discount', amount: -productSavings });
    }
    if (minOrderSavings > 0) {
        breakdown.push({ label: minOrderDiscount?.label || 'Order Discount', amount: -minOrderSavings });
    }
    if (couponSavings > 0) {
        breakdown.push({ label: couponDiscount?.label || `Coupon (${couponDiscount?.couponCode || ''})`, amount: -couponSavings });
    }
    if (freeShipping) {
        breakdown.push({ label: `Coupon (${couponDiscount?.couponCode || ''})`, amount: 0, freeShipping: true });
    }

    return {
        enrichedItems,
        rawSubtotal: Math.round(rawSubtotal * 100) / 100,
        productDiscountTotal: Math.round(productSavings * 100) / 100,
        productSavings: Math.round(productSavings * 100) / 100, // Legacy support
        discountedSubtotal: Math.round(discountedSubtotal * 100) / 100,
        bogoDiscountTotal: Math.round(minOrderSavings * 100) / 100, // Treating minOrder as BOGO for breakdown context
        minOrderDiscount,
        minOrderSavings: Math.round(minOrderSavings * 100) / 100,
        couponDiscountTotal: Math.round(couponSavings * 100) / 100,
        couponSavings: Math.round(couponSavings * 100) / 100,
        freeShipping,
        totalSavings: Math.round(totalSavings * 100) / 100,
        finalTotal: Math.round(finalSubtotal * 100) / 100,
        finalSubtotal: Math.round(finalSubtotal * 100) / 100,
        breakdown,
        appliedCoupon: couponDiscount ? couponDiscount.couponCode : null,
        appliedDiscounts: [
            ...enrichedItems.filter(i => i.activeDiscount).map(i => i.activeDiscount.id),
            ...(minOrderDiscount ? [minOrderDiscount.id] : []),
            ...(couponDiscount ? [couponDiscount.id] : [])
        ].filter((v, i, a) => v && a.indexOf(v) === i)
    };
}

/**
 * Returns the active flash sale discount (if any) — for banner display.
 */
function getActiveFlashSale(allDiscounts) {
    const now = Date.now();
    return allDiscounts.find(d => {
        if (!d.active || d.type !== 'flash_sale') return false;
        if (d.startDate && now < d.startDate) return false;
        if (d.endDate && now > d.endDate) return false;
        return true;
    }) || null;
}

/**
 * Format savings amount for display.
 */
function formatSavings(amount) {
    return '₹' + Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Get discount percentage string e.g. "20% OFF"
 */
function getDiscountBadgeText(discount) {
    if (!discount) return '';
    if (discount.discountType === 'percentage') return `${discount.value}% OFF`;
    if (discount.discountType === 'fixed') return `₹${discount.value} OFF`;
    if (discount.discountType === 'free_shipping') return 'FREE SHIP';
    return 'SALE';
}
