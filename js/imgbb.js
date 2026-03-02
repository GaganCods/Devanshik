// ============================================================
//  DEVANSHIK — ImgBB Upload Helper
// ============================================================

async function uploadImage(file) {
    if (!file) throw new Error('No file provided');
    const MAX_MB = 32;
    if (file.size > MAX_MB * 1024 * 1024) throw new Error(`File size must be under ${MAX_MB}MB`);

    const form = new FormData();
    form.append('image', file);

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: form
    });

    if (!res.ok) throw new Error('Upload failed — check your ImgBB API key');
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Upload failed');

    return {
        url: json.data.url,
        deleteUrl: json.data.delete_url,
        thumb: json.data.thumb?.url || json.data.url
    };
}

// ─── Convenience: wire file input with preview & progress ──────
function wireUploadInput({ inputEl, previewEl, btnEl, onSuccess, onError }) {
    if (!inputEl) return;

    inputEl.addEventListener('change', async () => {
        const file = inputEl.files[0];
        if (!file) return;

        // Show preview immediately
        if (previewEl) {
            const reader = new FileReader();
            reader.onload = e => {
                previewEl.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                previewEl.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }

        if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Uploading…'; }

        try {
            const result = await uploadImage(file);
            onSuccess && onSuccess(result);
        } catch (err) {
            onError ? onError(err) : showToast(err.message, 'error');
        } finally {
            if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Save'; }
        }
    });
}
