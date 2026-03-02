// ============================================================
//  DEVANSHIK — Central Cache System
// ============================================================

const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

function saveCache(key, data) {
    const payload = {
        data,
        timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(payload));
}

function getCache(key) {
    const item = localStorage.getItem(key);
    if (!item) return null;

    try {
        const parsed = JSON.parse(item);

        if (Date.now() - parsed.timestamp > CACHE_EXPIRY) {
            localStorage.removeItem(key);
            return null;
        }

        return parsed.data;
    } catch (e) {
        localStorage.removeItem(key);
        return null;
    }
}

// Ensure the functions are available globally
window.saveCache = saveCache;
window.getCache = getCache;
