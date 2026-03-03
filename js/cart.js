// ============================================================
//  DEVANSHIK — Cart Module (localStorage-backed)
// ============================================================

const CART_KEY = 'devanshik_cart';

function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
}

function saveCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    updateCartBadge();
}

function addToCart(item) {
    /* item: { productId, title, price, imageUrl, qty, size?, uploadedPhotoUrl?, productType, downloadFiles? } */
    const cart = getCart();
    const isDigital = item.productType === 'digital';
    const key = item.productId + (item.size || '');
    const idx = cart.findIndex(i => (i.productId + (i.size || '')) === key);

    if (isDigital) {
        // Digital products are always qty 1 — never stack
        if (idx >= 0) {
            // Already in cart — keep as is, caller should've shown toast
            showToast('Already in cart ⚡', 'warning');
            return;
        }
        cart.push({ ...item, qty: 1 });
    } else {
        if (idx >= 0) {
            cart[idx].qty = (cart[idx].qty || 1) + (item.qty || 1);
        } else {
            cart.push({ ...item, qty: item.qty || 1 });
        }
    }
    saveCart(cart);
    showToast('Added to cart 🛕', 'success');
}

function removeFromCart(productId, size = '') {
    const key = productId + size;
    saveCart(getCart().filter(i => (i.productId + (i.size || '')) !== key));
}

function updateCartQty(productId, size = '', qty) {
    const key = productId + size;
    const cart = getCart().map(i => {
        if ((i.productId + (i.size || '')) === key) i.qty = Math.max(1, qty);
        return i;
    });
    saveCart(cart);
}

function clearCart() {
    localStorage.removeItem(CART_KEY);
    updateCartBadge();
}

function getCartTotal() {
    return getCart().reduce((sum, i) => sum + i.price * (i.qty || 1), 0);
}

function getCartCount() {
    return getCart().reduce((sum, i) => sum + (i.qty || 1), 0);
}

function updateCartBadge() {
    document.querySelectorAll('.cart-count').forEach(el => {
        const count = getCartCount();
        const prevCount = parseInt(el.textContent) || 0;

        el.textContent = count;
        el.classList.toggle('hidden', count === 0);

        // Pop animation if count increased
        if (count > prevCount && count > 0) {
            el.classList.remove('pop');
            void el.offsetWidth; // Trigger reflow
            el.classList.add('pop');
        }
    });
}

// Call on page load to initialise badge
document.addEventListener('DOMContentLoaded', updateCartBadge);
