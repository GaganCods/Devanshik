// ============================================================
//  DEVANSHIK — Landing Page Editor V2
// ============================================================
let allProducts = {};
let banners = [], testimonials = [], categories = [];
let selectedProductIds = [];

// ─── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadAdminSidebar('/admin/pages/landing-editor');
    const user = await requireAdmin();
    const ud = await getUser(user.uid);
    const name = ud?.name || user.email;
    document.getElementById('admin-name').textContent = name;
    const av = document.getElementById('admin-avatar');
    if (ud?.profileImage) av.innerHTML = `<img src="${ud.profileImage}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    else av.textContent = name.charAt(0).toUpperCase();

    const [lp, theme, prods] = await Promise.all([
        getLandingPage().catch(() => ({})),
        getSiteTheme().catch(() => ({})),
        loadAllProducts().catch(() => ({}))
    ]);
    allProducts = {};
    if (prods) {
        Object.entries(prods).forEach(([id, p]) => {
            allProducts[id] = { ...p, id };
        });
    }
    populateHero(lp.hero);
    populateCategories(lp.categories);
    populateFeatured(lp.featured);
    populateStory(lp.story);
    populateTestimonials(lp.testimonials);
    populateCTA(lp.cta);
    populatePageBgs(theme.pageHeroes);
    buildProdGrid();
});

// ─── Helpers ──────────────────────────────────────────────
function toggleSection(bodyId, btn) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    body.classList.toggle('collapsed');
    btn.textContent = body.classList.contains('collapsed') ? 'Expand' : 'Collapse';
}

async function handleUpload(fileInputId, urlInputId, previewId, statusId) {
    const file = document.getElementById(fileInputId)?.files[0];
    if (!file) return;
    const statusEl = document.getElementById(statusId);
    const previewEl = document.getElementById(previewId);
    const urlEl = document.getElementById(urlInputId);
    const reader = new FileReader();
    reader.onload = e => {
        if (!previewEl) return;
        if (previewEl.tagName === 'IMG') { previewEl.src = e.target.result; previewEl.classList.add('visible'); previewEl.style.display = 'block'; }
        else { previewEl.innerHTML = `<img src="${e.target.result}">`; previewEl.classList.remove('hidden'); }
    };
    reader.readAsDataURL(file);
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--color-primary)">⏳ Uploading…</span>';
    try {
        const r = await uploadImage(file);
        urlEl.value = r.url;
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--color-success)">✓ Uploaded</span>';
    } catch (err) {
        if (statusEl) statusEl.innerHTML = `<span style="color:var(--color-danger)">✕ ${err.message}</span>`;
    }
}

async function handlePageHeroUpload(page) {
    const file = document.getElementById(`${page}-bg-file`)?.files[0];
    if (!file) return;
    const statusEl = document.getElementById(`${page}-bg-status`);
    const previewWrap = document.getElementById(`${page}-bg-preview-wrap`);
    const urlEl = document.getElementById(`${page}-bg-url`);
    const reader = new FileReader();
    reader.onload = e => { previewWrap.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100px;object-fit:cover;display:block;">`; };
    reader.readAsDataURL(file);
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--color-primary)">⏳ Uploading…</span>';
    try {
        const r = await uploadImage(file);
        urlEl.value = r.url;
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--color-success)">✓ Uploaded</span>';
    } catch (err) {
        if (statusEl) statusEl.innerHTML = `<span style="color:var(--color-danger)">✕ ${err.message}</span>`;
    }
}

// ═══════════════════════════════════════════════════════════
// SECTION 1 — HERO BANNERS
// ═══════════════════════════════════════════════════════════
function populateHero(hero) {
    if (!hero) return;
    if (hero.enabled !== undefined) document.getElementById('hero-enabled').checked = hero.enabled;
    banners = hero.banners ? Object.entries(hero.banners).map(([id, v]) => ({ ...v, id })).sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
    renderBanners();
}

function renderBanners() {
    const el = document.getElementById('banners-list');
    if (!banners.length) { el.innerHTML = '<div class="ls-empty">No banners yet. Add your first banner above.</div>'; return; }
    el.innerHTML = banners.map(b => {
        const typeLabel = 'B Image-Only';
        return `
        <div class="banner-card" data-id="${b.id}">
          <div class="banner-card-top">
            <span class="drag-handle" title="Drag to reorder">⠿</span>
            ${b.imageUrl ? `<img class="banner-card-img" src="${b.imageUrl}" alt="${b.altText || 'Banner'}">` : '<div class="banner-card-img-placeholder">No image</div>'}
            <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
              <div style="font-weight:700;font-size:var(--text-sm);">(Image-Based Banner)</div>
              ${b.link ? `<div style="font-size:var(--text-xs);color:var(--color-text-muted);">Link: ${b.link}</div>` : ''}
              <div style="font-size:var(--text-xs);color:var(--color-text-muted);">Order: ${b.order || 1}</div>
            </div>
          </div>
          <div class="banner-card-actions">
            <label class="ls-toggle">
              <input type="checkbox" class="toggle-input" onchange="toggleBannerEnabled('${b.id}',this.checked)" ${b.enabled !== false ? 'checked' : ''}>
              <span class="toggle-pill"></span> Active
            </label>
            <div style="display:flex;gap:var(--space-2);">
              <button class="btn btn-sm" onclick="editBanner('${b.id}')" style="background:var(--color-surface-alt);border:1px solid var(--color-border);">✏️ Edit</button>
              <button class="btn btn-sm" onclick="deleteBannerItem('${b.id}')" style="background:var(--color-surface-alt);border:1px solid var(--color-border);color:var(--color-danger);">🗑 Delete</button>
            </div>
          </div>
        </div>`;
    }).join('');
}



function openBannerModal(id) {
    clearBannerModal();
    document.getElementById('banner-modal-title').textContent = id ? 'Edit Banner' : 'Add Hero Banner';
    document.getElementById('banner-save-btn').textContent = id ? 'Save Changes' : 'Add Banner';
    if (id) {
        const b = banners.find(x => x.id === id);
        if (!b) return;
        document.getElementById('banner-edit-id').value = id;
        document.getElementById('banner-edit-id').value = id;
        document.getElementById('banner-link').value = b.link || '';
        document.getElementById('banner-alt').value = b.altText || '';
        document.getElementById('banner-order').value = b.order || 1;
        document.getElementById('banner-img-url').value = b.imageUrl || '';
        if (b.imageUrl) { const p = document.getElementById('banner-img-preview'); p.innerHTML = `<img src="${b.imageUrl}">`; p.classList.remove('hidden'); }
    }
    document.getElementById('banner-modal').classList.add('active');
}

function clearBannerModal() {
    ['banner-edit-id', 'banner-link', 'banner-alt', 'banner-img-url'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('banner-order').value = 1;
    document.getElementById('banner-img-preview').innerHTML = '';
    document.getElementById('banner-img-preview').classList.add('hidden');
    document.getElementById('banner-img-status').innerHTML = '';
}

function editBanner(id) { openBannerModal(id); }
function closeBannerModal() { document.getElementById('banner-modal').classList.remove('active'); }

async function saveBanner() {
    const btn = document.getElementById('banner-save-btn');
    const editId = document.getElementById('banner-edit-id').value;
    const imgUrl = document.getElementById('banner-img-url').value;
    if (!imgUrl) { showToast('Please upload a banner image first.', 'error'); return; }
    const data = {
        type: 'image-only', imageUrl: imgUrl, altText: document.getElementById('banner-alt').value.trim(),
        order: parseInt(document.getElementById('banner-order').value) || 1,
        enabled: true,
        link: document.getElementById('banner-link').value.trim()
    };
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
        await writeLandingBanner(data, editId || null);
        showToast(editId ? 'Banner updated!' : 'Banner added!', 'success');
        closeBannerModal();
        const lp = await getLandingPage(); populateHero(lp.hero);
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = editId ? 'Save Changes' : 'Add Banner'; }
}

async function deleteBannerItem(id) {
    if (!confirm('Delete this banner?')) return;
    try { await deleteLandingBanner(id); showToast('Banner deleted.'); const lp = await getLandingPage(); populateHero(lp.hero); }
    catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function toggleBannerEnabled(id, enabled) {
    try { await db.ref(`landingPage/hero/banners/${id}`).update({ enabled }); showToast(enabled ? 'Banner enabled.' : 'Banner disabled.'); }
    catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function saveHeroEnabled() {
    try { await saveLandingSection('hero', { enabled: document.getElementById('hero-enabled').checked }); showToast('Hero settings saved!', 'success'); }
    catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════
// SECTION 2 — CATEGORIES
// ═══════════════════════════════════════════════════════════
function populateCategories(cats) {
    if (!cats) return;
    if (cats.enabled !== undefined) document.getElementById('cat-enabled').checked = cats.enabled;
    categories = cats.items ? Object.entries(cats.items).map(([id, v]) => ({ ...v, id })).sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
    renderCategories();
}

function renderCategories() {
    const el = document.getElementById('categories-list');
    if (!categories.length) { el.innerHTML = '<div class="ls-empty">No categories yet.</div>'; return; }
    el.innerHTML = categories.map(c => `
    <div class="cat-card">
      <div class="cat-card-top">
        ${c.imageUrl ? `<img class="cat-card-img" src="${c.imageUrl}" alt="${c.name}">` : '<div class="cat-card-img-placeholder">🖼️</div>'}
        <div style="flex:1;">
          <div style="font-weight:700;font-size:var(--text-sm);">${c.name || '(no name)'}</div>
          <div style="font-size:var(--text-xs);color:var(--color-text-muted);">Slug: ${c.slug || '—'} | Order: ${c.order || 1}</div>
          <div style="font-size:var(--text-xs);color:var(--color-text-muted);">${c.subtitle || ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-2);">
          <label class="ls-toggle"><input type="checkbox" class="toggle-input" ${c.enabled !== false ? 'checked' : ''} onchange="updateCatEnabled('${c.id}',this.checked)"><span class="toggle-pill"></span></label>
          <button class="btn btn-sm" onclick="editCat('${c.id}')" style="background:var(--color-surface-alt);border:1px solid var(--color-border);">✏️</button>
          <button class="btn btn-sm" onclick="deleteCatItem('${c.id}')" style="background:var(--color-surface-alt);border:1px solid var(--color-border);color:var(--color-danger);">🗑</button>
        </div>
      </div>
    </div>`).join('');
}

function openCatModal(id) {
    clearCatModal();
    document.getElementById('cat-modal-title').textContent = id ? 'Edit Category' : 'Add Category';
    document.getElementById('cat-save-btn').textContent = id ? 'Save Changes' : 'Add Category';
    if (id) {
        const c = categories.find(x => x.id === id);
        if (!c) return;
        document.getElementById('cat-edit-id').value = id;
        document.getElementById('cat-name').value = c.name || '';
        document.getElementById('cat-slug').value = c.slug || '';
        document.getElementById('cat-subtitle').value = c.subtitle || '';
        document.getElementById('cat-order').value = c.order || 1;
        document.getElementById('cat-img-url').value = c.imageUrl || '';
        if (c.imageUrl) { const p = document.getElementById('cat-img-preview'); p.innerHTML = `<img src="${c.imageUrl}">`; p.classList.remove('hidden'); }
    }
    document.getElementById('cat-modal').classList.add('active');
}

function clearCatModal() {
    ['cat-edit-id', 'cat-name', 'cat-slug', 'cat-subtitle', 'cat-img-url'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('cat-order').value = 1;
    document.getElementById('cat-img-preview').innerHTML = '';
    document.getElementById('cat-img-preview').classList.add('hidden');
    document.getElementById('cat-img-status').innerHTML = '';
}
function editCat(id) { openCatModal(id); }
function closeCatModal() { document.getElementById('cat-modal').classList.remove('active'); }

async function saveCat() {
    const btn = document.getElementById('cat-save-btn');
    const editId = document.getElementById('cat-edit-id').value;
    const name = document.getElementById('cat-name').value.trim();
    if (!name) { showToast('Name is required', 'error'); return; }
    const data = { name, slug: document.getElementById('cat-slug').value.trim(), subtitle: document.getElementById('cat-subtitle').value.trim(), imageUrl: document.getElementById('cat-img-url').value, order: parseInt(document.getElementById('cat-order').value) || 1, enabled: true };
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
        await writeLandingCategory(data, editId || null);
        showToast(editId ? 'Category updated!' : 'Category added!', 'success');
        closeCatModal();
        const lp = await getLandingPage(); populateCategories(lp.categories);
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = editId ? 'Save Changes' : 'Add Category'; }
}

async function deleteCatItem(id) {
    if (!confirm('Delete this category?')) return;
    try { await deleteLandingCategory(id); showToast('Deleted.'); const lp = await getLandingPage(); populateCategories(lp.categories); }
    catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function updateCatEnabled(id, enabled) {
    try { await db.ref(`landingPage/categories/items/${id}`).update({ enabled }); }
    catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function saveCatSection() {
    try { await saveLandingSection('categories', { enabled: document.getElementById('cat-enabled').checked }); showToast('Categories saved!', 'success'); }
    catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════
// SECTION 3 — FEATURED PRODUCTS (Visual Selector)
// ═══════════════════════════════════════════════════════════
function populateFeatured(feat) {
    if (!feat) return;
    if (feat.enabled !== undefined) document.getElementById('feat-enabled').checked = feat.enabled;
    if (feat.title) document.getElementById('feat-title').value = feat.title;
    if (feat.subtitle) document.getElementById('feat-subtitle').value = feat.subtitle;
    if (feat.layout) {
        const radio = document.querySelector(`input[name="feat-layout"][value="${feat.layout}"]`);
        if (radio) radio.checked = true;
    }
    selectedProductIds = feat.productIds ? [...feat.productIds].filter(Boolean) : [];
    renderSelectedProducts();
    buildProdGrid();
}

function getFeatMax() {
    return parseInt(document.querySelector('input[name="feat-layout"]:checked')?.value || '4');
}

function updateFeatMax() {
    buildProdGrid();
    renderSelectedProducts();
}

function buildProdGrid() {
    const grid = document.getElementById('prod-selector-grid');
    if (!grid) return;
    const search = document.getElementById('prod-search')?.value?.toLowerCase() || '';
    const prods = Object.values(allProducts).filter(p => p && (!search || p.title?.toLowerCase().includes(search) || (p.category || '').toLowerCase().includes(search)));
    if (!prods.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:var(--space-6);color:var(--color-text-muted);">${Object.keys(allProducts).length ? 'No products match your search.' : 'No products found in your store.'}</div>`;
        return;
    }
    const max = getFeatMax();
    grid.innerHTML = prods.map(p => {
        const sel = selectedProductIds.includes(p.id);
        const disabled = !sel && selectedProductIds.length >= max;
        return `
        <div class="prod-sel-card ${sel ? 'selected' : ''} ${disabled ? 'disabled' : ''}" onclick="toggleProductSelect('${p.id}')" style="${disabled ? 'opacity:.5;pointer-events:none;' : ''}">
          <input type="checkbox" ${sel ? 'checked' : ''} onclick="event.stopPropagation();toggleProductSelect('${p.id}')">
          ${p.images?.[0] ? `<img src="${p.images[0]}" alt="${p.title}" loading="lazy">` : `<div style="width:100%;height:80px;background:var(--color-surface-alt);border-radius:var(--radius-md);margin-bottom:var(--space-2);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">🖼️</div>`}
          <span class="psc-badge ${p.productType === 'digital' ? 'digital' : 'physical'}">${p.productType === 'digital' ? 'Digital' : 'Physical'}</span>
          <div class="psc-title">${p.title}</div>
          <div class="psc-price">₹${p.price}</div>
        </div>`;
    }).join('');
}

function filterProdGrid() { buildProdGrid(); }

function toggleProductSelect(productId) {
    const max = getFeatMax();
    const idx = selectedProductIds.indexOf(productId);
    if (idx > -1) {
        selectedProductIds.splice(idx, 1);
    } else {
        if (selectedProductIds.length >= max) { showToast(`Max ${max} products allowed for this layout.`, 'error'); return; }
        selectedProductIds.push(productId);
    }
    renderSelectedProducts();
    buildProdGrid();
}

function renderSelectedProducts() {
    const max = getFeatMax();
    const list = document.getElementById('selected-prod-list');
    document.getElementById('feat-count-label').textContent = `(${selectedProductIds.length} / ${max} selected)`;
    if (!selectedProductIds.length) {
        list.innerHTML = '<span style="color:var(--color-text-muted);font-size:var(--text-xs);padding:var(--space-2);">No products selected yet.</span>';
        return;
    }
    list.innerHTML = selectedProductIds.map((id, i) => {
        const p = allProducts[id];
        if (!p) return '';
        return `<div class="sel-prod-chip" draggable="true" data-id="${id}">
          ${p.images?.[0] ? `<img src="${p.images[0]}" alt="${p.title}">` : '<span>🖼️</span>'}
          <span>${p.title}</span>
          <button onclick="removeSelectedProduct('${id}')" title="Remove">✕</button>
        </div>`;
    }).filter(Boolean).join('');
}

function removeSelectedProduct(id) {
    selectedProductIds = selectedProductIds.filter(x => x !== id);
    renderSelectedProducts();
    buildProdGrid();
}

async function saveFeatured() {
    const data = {
        enabled: document.getElementById('feat-enabled').checked,
        title: document.getElementById('feat-title').value.trim(),
        subtitle: document.getElementById('feat-subtitle').value.trim(),
        layout: document.querySelector('input[name="feat-layout"]:checked')?.value || '4',
        productIds: selectedProductIds.filter(Boolean)
    };
    try { await saveLandingFeatured(data); showToast('Featured products saved!', 'success'); }
    catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════
// SECTION 4 — STORY
// ═══════════════════════════════════════════════════════════
function populateStory(story) {
    if (!story) return;
    if (story.enabled !== undefined) document.getElementById('story-enabled').checked = story.enabled;
    if (story.title) document.getElementById('story-title').value = story.title;
    if (story.subtitle) document.getElementById('story-subtitle').value = story.subtitle;
    if (story.content) document.getElementById('story-content').value = story.content;
    if (story.buttonText) document.getElementById('story-btn-text').value = story.buttonText;
    if (story.buttonLink) document.getElementById('story-btn-link').value = story.buttonLink;
    if (story.imagePosition) { const r = document.querySelector(`input[name="story-pos"][value="${story.imagePosition}"]`); if (r) r.checked = true; }
    if (story.imageUrl) {
        document.getElementById('story-img-url').value = story.imageUrl;
        const p = document.getElementById('story-img-preview');
        p.src = story.imageUrl; p.style.display = 'block';
    }
}

async function saveStory() {
    const data = {
        enabled: document.getElementById('story-enabled').checked,
        title: document.getElementById('story-title').value.trim(),
        subtitle: document.getElementById('story-subtitle').value.trim(),
        content: document.getElementById('story-content').value.trim(),
        buttonText: document.getElementById('story-btn-text').value.trim(),
        buttonLink: document.getElementById('story-btn-link').value.trim(),
        imageUrl: document.getElementById('story-img-url').value,
        imagePosition: document.querySelector('input[name="story-pos"]:checked')?.value || 'left'
    };
    try { await saveLandingSection('story', data); showToast('Story section saved!', 'success'); }
    catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════
// SECTION 5 — TESTIMONIALS
// ═══════════════════════════════════════════════════════════
function populateTestimonials(testis) {
    if (!testis) return;
    if (testis.enabled !== undefined) document.getElementById('testi-enabled').checked = testis.enabled;
    testimonials = testis.items ? Object.entries(testis.items).map(([id, v]) => ({ ...v, id })).sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
    renderTestimonials();
}

function renderTestimonials() {
    const el = document.getElementById('testi-list');
    if (!testimonials.length) { el.innerHTML = '<div class="ls-empty">No testimonials yet.</div>'; return; }
    el.innerHTML = testimonials.map(t => `
    <div class="testi-card">
      <div class="testi-card-top">
        <div class="testi-avatar-wrap">
          ${t.avatarUrl ? `<img src="${t.avatarUrl}" alt="${t.name}">` : `<div class="testi-avatar-placeholder">${(t.name || '?').charAt(0).toUpperCase()}</div>`}
        </div>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:var(--text-sm);">${t.name || '(no name)'} — ${t.city || ''}</div>
          <div style="color:#F59E0B;font-size:var(--text-sm);">${'★'.repeat(t.rating || 5)}${'☆'.repeat(5 - (t.rating || 5))}</div>
          <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:2px;">"${t.message || ''}"</div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-2);">
          <label class="ls-toggle"><input type="checkbox" class="toggle-input" ${t.enabled !== false ? 'checked' : ''} onchange="updateTestiEnabled('${t.id}',this.checked)"><span class="toggle-pill"></span></label>
          <button class="btn btn-sm" onclick="editTesti('${t.id}')" style="background:var(--color-surface-alt);border:1px solid var(--color-border);">✏️</button>
          <button class="btn btn-sm" onclick="deleteTestiItem('${t.id}')" style="background:var(--color-surface-alt);border:1px solid var(--color-border);color:var(--color-danger);">🗑</button>
        </div>
      </div>
    </div>`).join('');
}

function openTestiModal(id) {
    clearTestiModal();
    document.getElementById('testi-modal-title').textContent = id ? 'Edit Testimonial' : 'Add Testimonial';
    document.getElementById('testi-save-btn').textContent = id ? 'Save Changes' : 'Add Testimonial';
    if (id) {
        const t = testimonials.find(x => x.id === id);
        if (!t) return;
        document.getElementById('testi-edit-id').value = id;
        document.getElementById('testi-name').value = t.name || '';
        document.getElementById('testi-city').value = t.city || '';
        document.getElementById('testi-message').value = t.message || '';
        const r = document.getElementById(`r${t.rating || 5}`); if (r) r.checked = true;
        document.getElementById('testi-avatar-url').value = t.avatarUrl || '';
        if (t.avatarUrl) { const p = document.getElementById('testi-avatar-preview'); p.innerHTML = `<img src="${t.avatarUrl}">`; p.classList.remove('hidden'); }
    }
    document.getElementById('testi-modal').classList.add('active');
}

function clearTestiModal() {
    ['testi-edit-id', 'testi-name', 'testi-city', 'testi-message', 'testi-avatar-url'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('r5').checked = true;
    document.getElementById('testi-avatar-preview').innerHTML = '';
    document.getElementById('testi-avatar-preview').classList.add('hidden');
    document.getElementById('testi-avatar-status').innerHTML = '';
}
function editTesti(id) { openTestiModal(id); }
function closeTestiModal() { document.getElementById('testi-modal').classList.remove('active'); }

async function saveTesti() {
    const btn = document.getElementById('testi-save-btn');
    const editId = document.getElementById('testi-edit-id').value;
    const name = document.getElementById('testi-name').value.trim();
    if (!name) { showToast('Name is required', 'error'); return; }
    const rating = parseInt(document.querySelector('input[name="testi-rating"]:checked')?.value) || 5;
    const data = { name, city: document.getElementById('testi-city').value.trim(), message: document.getElementById('testi-message').value.trim(), rating, avatarUrl: document.getElementById('testi-avatar-url').value, enabled: true, order: editId ? (testimonials.find(t => t.id === editId)?.order || testimonials.length + 1) : testimonials.length + 1 };
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
        await writeLandingTestimonial(data, editId || null);
        showToast(editId ? 'Updated!' : 'Added!', 'success');
        closeTestiModal();
        const lp = await getLandingPage(); populateTestimonials(lp.testimonials);
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = editId ? 'Save Changes' : 'Add Testimonial'; }
}

async function deleteTestiItem(id) {
    if (!confirm('Delete this testimonial?')) return;
    try { await deleteLandingTestimonial(id); showToast('Deleted.'); const lp = await getLandingPage(); populateTestimonials(lp.testimonials); }
    catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function updateTestiEnabled(id, enabled) {
    try { await db.ref(`landingPage/testimonials/items/${id}`).update({ enabled }); }
    catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function saveTestiEnabled() {
    try { await saveLandingSection('testimonials', { enabled: document.getElementById('testi-enabled').checked }); showToast('Testimonials saved!', 'success'); }
    catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════
// SECTION 6 — CTA
// ═══════════════════════════════════════════════════════════
function toggleCtaBgType() {
    const type = document.querySelector('input[name="cta-bg-type"]:checked')?.value;
    document.getElementById('cta-color-wrap').style.display = type === 'color' ? '' : 'none';
    document.getElementById('cta-image-wrap').style.display = type === 'image' ? '' : 'none';
    document.getElementById('cta-gradient-wrap').style.display = type === 'gradient' ? '' : 'none';
    updateCtaPreview();
}

function updateCtaPreview() {
    const type = document.querySelector('input[name="cta-bg-type"]:checked')?.value;
    const preview = document.getElementById('cta-real-preview');
    if (!preview) return;
    const title = document.getElementById('cta-title').value;
    const sub = document.getElementById('cta-subtitle').value;

    const previewTitle = document.getElementById('cta-preview-title');
    const previewSub = document.getElementById('cta-preview-subtitle');
    if (previewTitle) previewTitle.textContent = title || 'CTA Title';
    if (previewSub) previewSub.textContent = sub || 'CTA Subtitle';

    if (type === 'color') {
        preview.style.background = document.getElementById('cta-bg-color').value;
        preview.style.backgroundImage = '';
    } else if (type === 'image') {
        const url = document.getElementById('cta-bg-img-url').value;
        if (url) {
            preview.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(44,26,14,0.7)), url(${url})`;
            preview.style.backgroundSize = 'cover';
        } else {
            preview.style.background = '#eee';
            preview.style.backgroundImage = '';
        }
    } else if (type === 'gradient') {
        const gradType = document.getElementById('cta-gradient-type').value;
        const color1 = document.getElementById('cta-grad-color1').value;
        const color2 = document.getElementById('cta-grad-color2').value;
        const dir = document.getElementById('cta-gradient-dir').value || "135";
        const direction = dir.includes('deg') ? dir : `${dir}deg`;

        if (gradType === 'linear') {
            preview.style.background = `linear-gradient(${direction}, ${color1}, ${color2})`;
        } else {
            preview.style.background = `radial-gradient(circle, ${color1}, ${color2})`;
        }
        preview.style.backgroundImage = '';
    }
}

function applyCtaPreset(c1, c2) {
    document.getElementById('cta-grad-color1').value = c1;
    document.getElementById('cta-grad-color2').value = c2;
    updateCtaPreview();
}

function populateCTA(cta) {
    if (!cta) return;
    if (cta.enabled !== undefined) document.getElementById('cta-enabled').checked = cta.enabled;
    if (cta.title) document.getElementById('cta-title').value = cta.title;
    if (cta.subtitle) document.getElementById('cta-subtitle').value = cta.subtitle;
    if (cta.buttonText) document.getElementById('cta-btn-text').value = cta.buttonText;
    if (cta.buttonLink) document.getElementById('cta-btn-link').value = cta.buttonLink;
    if (cta.textAlign) document.getElementById('cta-text-align').value = cta.textAlign;
    if (cta.backgroundType) {
        const r = document.querySelector(`input[name="cta-bg-type"][value="${cta.backgroundType}"]`);
        if (r) { r.checked = true; toggleCtaBgType(); }
    }
    if (cta.backgroundColor) document.getElementById('cta-bg-color').value = cta.backgroundColor;
    if (cta.backgroundImage) {
        document.getElementById('cta-bg-img-url').value = cta.backgroundImage;
    }
    if (cta.gradientType) document.getElementById('cta-gradient-type').value = cta.gradientType;
    if (cta.direction || cta.gradientDir) document.getElementById('cta-gradient-dir').value = cta.direction || cta.gradientDir;
    if (cta.color1) document.getElementById('cta-grad-color1').value = cta.color1;
    if (cta.color2) document.getElementById('cta-grad-color2').value = cta.color2;

    updateCtaPreview();
}

async function saveCTA() {
    const bgType = document.querySelector('input[name="cta-bg-type"]:checked')?.value || 'color';
    const data = {
        enabled: document.getElementById('cta-enabled').checked,
        title: document.getElementById('cta-title').value.trim(),
        subtitle: document.getElementById('cta-subtitle').value.trim(),
        buttonText: document.getElementById('cta-btn-text').value.trim(),
        buttonLink: document.getElementById('cta-btn-link').value.trim(),
        textAlign: document.getElementById('cta-text-align').value,
        backgroundType: bgType,
        backgroundColor: bgType === 'color' ? document.getElementById('cta-bg-color').value : null,
        backgroundImage: bgType === 'image' ? document.getElementById('cta-bg-img-url').value : null,
        gradientType: bgType === 'gradient' ? document.getElementById('cta-gradient-type').value : null,
        direction: bgType === 'gradient' ? document.getElementById('cta-gradient-dir').value || '135deg' : null,
        color1: bgType === 'gradient' ? document.getElementById('cta-grad-color1').value : null,
        color2: bgType === 'gradient' ? document.getElementById('cta-grad-color2').value : null
    };
    try { await saveLandingSection('cta', data); showToast('CTA section saved!', 'success'); }
    catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════
// SECTION 7 — PAGE BACKGROUNDS
// ═══════════════════════════════════════════════════════════
function populatePageBgs(pageHeroes) {
    if (!pageHeroes) return;
    ['shop', 'product', 'checkout'].forEach(page => {
        const bg = pageHeroes[page];
        if (bg) {
            if (bg.enabled !== undefined) { const el = document.getElementById(`${page}-bg-enabled`); if (el) el.checked = bg.enabled; }
            if (bg.imageUrl) {
                document.getElementById(`${page}-bg-url`).value = bg.imageUrl;
                document.getElementById(`${page}-bg-preview-wrap`).innerHTML = `<img src="${bg.imageUrl}" style="width:100%;height:100px;object-fit:cover;display:block;">`;
            }
        }
    });
}

async function savePageHeroSection(page) {
    const url = document.getElementById(`${page}-bg-url`).value;
    const enabled = document.getElementById(`${page}-bg-enabled`).checked;
    if (!url && enabled) { showToast('Please upload an image first.', 'error'); return; }
    try {
        await savePageHero(page, { imageUrl: url, enabled });
        showToast(`${page.charAt(0).toUpperCase() + page.slice(1)} hero saved!`, 'success');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function removePageHeroBg(page) {
    if (!confirm(`Remove the ${page} hero background image?`)) return;
    try {
        await savePageHero(page, { imageUrl: '', enabled: document.getElementById(`${page}-bg-enabled`).checked });
        document.getElementById(`${page}-bg-url`).value = '';
        document.getElementById(`${page}-bg-preview-wrap`).innerHTML = { shop: '🛍️ Shop Hero', product: '🛒 Product Hero', checkout: '💳 Checkout Hero' }[page];
        showToast(`${page} background removed.`, 'success');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ─── sign out helper ───────────────────────────────────────
async function adminSignOut() {
    await signOutUser();
    window.location.href = '/login';
}
