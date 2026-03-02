// ============================================================
//  DEVANSHIK — Authentication Module
// ============================================================

function getCachedUser() {
    if (window.APP_CACHE && window.APP_CACHE.user) {
        return window.APP_CACHE.user;
    }

    const cached = localStorage.getItem('user_profile') || window.getCache?.('user_profile');
    if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        window.APP_CACHE = window.APP_CACHE || {};
        window.APP_CACHE.user = parsed;
        return parsed;
    }

    return null;
}

function instantProfileRender() {
    const cached = localStorage.getItem("user_profile");
    if (!cached) return;

    try {
        const user = JSON.parse(cached);

        // Hide login buttons immediately
        const loginBtn = document.getElementById("login-btn");
        if (loginBtn) loginBtn.classList.add("hidden");
        const mobileLoginBtn = document.getElementById("mobile-login-btn");
        if (mobileLoginBtn) mobileLoginBtn.classList.add("hidden");

        // Show profile elements immediately
        const profileWrapper = document.getElementById("profile-wrapper");
        if (profileWrapper) profileWrapper.classList.remove("hidden");
        const mobileProfileLinks = document.getElementById("mobile-profile-links");
        if (mobileProfileLinks) mobileProfileLinks.classList.remove("hidden");

        // Set initials instantly
        const name = user.name || user.email?.split('@')[0] || "User";
        const email = user.email || "";
        const initial = name.charAt(0).toUpperCase();

        const nameEl = document.getElementById("menu-user-name");
        if (nameEl) nameEl.textContent = name;
        const emailEl = document.getElementById("menu-user-email");
        if (emailEl) emailEl.textContent = email;
        const initialEl = document.getElementById("profile-initial");
        if (initialEl) initialEl.textContent = initial;

        const adminLink = document.getElementById("admin-link");
        if (adminLink && user.role === 'admin') {
            adminLink.classList.remove("hidden");
        }
    } catch (e) {
        console.error("Instant render error:", e);
    }
}

document.addEventListener("componentsLoaded", () => {
    instantProfileRender();
});

function onAuthChange(callback) {
    auth.onAuthStateChanged(async user => {
        if (!user) { callback(null, null); return; }

        const cached = getCachedUser();
        if (cached && cached.role) {
            callback(user, cached.role);

            // Background update
            db.ref(`users/${user.uid}`).once('value').then(snap => {
                const userData = snap.val() || { role: 'customer' };
                window.saveCache('user_profile', userData);
                window.APP_CACHE.user = userData;
            }).catch(e => console.error(e));
            return;
        }

        const snap = await db.ref(`users/${user.uid}`).once('value');
        const userData = snap.val() || { role: 'customer' };
        window.saveCache('user_profile', userData);
        window.APP_CACHE.user = userData;
        callback(user, userData.role);
    });
}

// ─── Register ────────────────────────────────────────────────
async function registerWithEmail(name, email, password) {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.ref(`users/${cred.user.uid}`).set({
        name, email,
        role: 'customer',
        createdAt: Date.now()
    }).then(() => console.log("User profile saved to DB (signup)"))
        .catch(err => console.error("Database write error during signup:", err));
    return cred.user;
}

// ─── Sign In ──────────────────────────────────────────────────
async function signInWithEmail(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
}

// ─── Google Sign In ───────────────────────────────────────────
async function signInWithGoogle() {
    const cred = await auth.signInWithPopup(googleProvider);
    const snap = await db.ref(`users/${cred.user.uid}`).once('value');
    if (!snap.exists()) {
        await db.ref(`users/${cred.user.uid}`).set({
            name: cred.user.displayName || 'User',
            email: cred.user.email,
            role: 'customer',
            createdAt: Date.now()
        }).then(() => console.log("User profile saved to DB (Google)"))
            .catch(err => console.error("Database write error during Google sign-in:", err));
    }
    return cred.user;
}

// ─── Sign Out ─────────────────────────────────────────────────
function signOutUser() {
    localStorage.removeItem('user_profile');
    window.APP_CACHE.user = null;
    if (auth.currentUser) {
        localStorage.removeItem(`userRole_${auth.currentUser.uid}`);
    }
    return auth.signOut();
}

// ─── Route Guards ─────────────────────────────────────────────
function requireAuth(redirectTo = '/login') {
    return new Promise(resolve => {
        auth.onAuthStateChanged(user => {
            if (!user) { window.location.href = redirectTo; }
            else resolve(user);
        });
    });
}

async function requireAdmin() {
    const user = await requireAuth('/login');

    let role = null;
    const cached = getCachedUser();
    if (cached) {
        role = cached.role;
    }

    if (!role) {
        const snap = await db.ref(`users/${user.uid}`).once('value');
        const userData = snap.val() || { role: 'customer' };
        role = userData.role;
        window.saveCache('user_profile', userData);
        window.APP_CACHE.user = userData;
    }

    if (role !== 'admin') window.location.href = '/';
    return user;
}

// ─── Header auth state wiring ─────────────────────────────────
// ─── Header auth state wiring ─────────────────────────────────
function wireHeaderAuth() {
    const user = firebase.auth().currentUser;
    updateHeaderUI(user);
}

// Listen for auth changes globally
firebase.auth().onAuthStateChanged(async user => {
    if (!user) {
        localStorage.removeItem("user_profile");
        // Clear wishlist cache/local on logout
        if (typeof WISHLIST_KEY !== 'undefined') {
            localStorage.removeItem(WISHLIST_KEY);
            document.dispatchEvent(new Event('wishlistUpdated'));
        }
        updateHeaderUI(null);
        return;
    }

    // Silent Background Sync
    try {
        const snap = await firebase.database().ref(`users/${user.uid}`).once("value");
        const userData = snap.val();
        if (userData) {
            const profileData = {
                uid: user.uid,
                name: userData.name,
                email: userData.email,
                role: userData.role,
                photoURL: user.photoURL || null
            };
            localStorage.setItem("user_profile", JSON.stringify(profileData));
        }
    } catch (e) {
        console.error("Background sync error:", e);
    }

    // Robust safety net: Guarantee user exists in Realtime Database
    try {
        const userRef = firebase.database().ref(`users/${user.uid}`);
        const snap = await userRef.once("value");
        if (!snap.exists()) {
            console.log("Persistence safety net: Creating missing database profile...");
            await userRef.set({
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                role: "customer",
                createdAt: Date.now()
            });
            console.log("Profile created successfully via safety net.");
        }
    } catch (err) {
        console.error("Auth state safety net error:", err);
    }

    // Initialize wishlist persistence
    if (typeof initWishlistPersistence === 'function') {
        initWishlistPersistence(user.uid);
    }

    updateHeaderUI(user);
});

async function updateHeaderUI(user) {
    const headerContainer = document.getElementById("header-container");
    const loginBtn = headerContainer ? headerContainer.querySelector("#login-btn") : null;
    const profileWrapper = document.getElementById("profile-wrapper");
    const mobileLoginBtn = document.getElementById("mobile-login-btn");
    const mobileProfileLinks = document.getElementById("mobile-profile-links");

    // Hide Login Icon instantly if user is cached
    if (getCachedUser() || localStorage.getItem("user_cache")) {
        if (loginBtn) loginBtn.classList.add("hidden");
    }

    if (user) {
        // Fast Load From Cache
        const cached = getCachedUser();
        if (cached) {
            renderUserUI(cached, loginBtn, profileWrapper, mobileLoginBtn, mobileProfileLinks);
        } else {
            // Instant render with what's available
            renderUserUI({
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                role: 'customer' // fallback
            }, loginBtn, profileWrapper, mobileLoginBtn, mobileProfileLinks);
        }

        // Silent refresh in background
        try {
            const snap = await firebase.database().ref(`users/${user.uid}`).once("value");
            const freshData = snap.val();
            if (freshData) {
                localStorage.setItem('user_cache', JSON.stringify(freshData));
                window.APP_CACHE.user = freshData;
                renderUserUI(freshData, loginBtn, profileWrapper, mobileLoginBtn, mobileProfileLinks);
            }
        } catch (e) { console.error("Error refreshing profile:", e); }

    } else {
        // Logged out
        if (loginBtn) {
            loginBtn.classList.remove("hidden");
            if (!loginBtn.dataset.wired) {
                loginBtn.dataset.wired = "1";
                loginBtn.addEventListener("click", () => {
                    window.location.href = "/login";
                });
            }
        }
        if (profileWrapper) profileWrapper.classList.add("hidden");
        if (mobileLoginBtn) mobileLoginBtn.classList.remove("hidden");
        if (mobileProfileLinks) mobileProfileLinks.classList.add("hidden");
    }
}

function renderUserUI(userData, loginBtn, profileWrapper, mobileLoginBtn, mobileProfileLinks) {
    if (loginBtn) loginBtn.classList.add("hidden");
    if (profileWrapper) profileWrapper.classList.remove("hidden");
    if (mobileLoginBtn) mobileLoginBtn.classList.add("hidden");
    if (mobileProfileLinks) mobileProfileLinks.classList.remove("hidden");

    const name = userData.name || userData.email?.split('@')[0] || "User";
    const email = userData.email || "";
    const initial = name[0] ? name[0].toUpperCase() : "U";

    const nameEl = document.getElementById("menu-user-name");
    const emailEl = document.getElementById("menu-user-email");
    const initialEl = document.getElementById("profile-initial");

    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
    if (initialEl) initialEl.textContent = initial;

    const adminLink = document.getElementById("admin-link");
    if (adminLink) {
        if (userData.role === "admin") {
            adminLink.classList.remove("hidden");
        } else {
            adminLink.classList.add("hidden");
        }
    }
}

/* Dropdown toggle & Outside click */
document.addEventListener("click", function (e) {
    const profile = document.getElementById("profile-wrapper");
    const toggle = document.getElementById("profile-toggle");
    const dropdown = document.getElementById("profile-dropdown");

    if (!profile || !toggle || !dropdown) return;

    if (toggle.contains(e.target)) {
        profile.classList.toggle("open");
    } else if (!dropdown.contains(e.target)) {
        profile.classList.remove("open");
    }
});

// Logout logic (handles all logout buttons: dropdown, sidebar)
document.addEventListener("click", function (e) {
    const logoutBtn = e.target.closest("#logout-btn, #mobile-logout-btn, #sidebar-logout-btn");
    if (logoutBtn) {
        firebase.auth().signOut().then(() => {
            window.location.href = '/';
        });
    }
});

// Header scroll effect
window.addEventListener('scroll', () => {
    const header = document.querySelector('.site-header');
    if (header) {
        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
});
