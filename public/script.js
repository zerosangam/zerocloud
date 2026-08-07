document.addEventListener('DOMContentLoaded', () => {
    let session = JSON.parse(localStorage.getItem('zerocloud_session') || 'null');
    let state = { files: [], activeCategory: 'all', searchQuery: '' };

    // DOM Selectors
    const authScreen = document.getElementById('auth-screen');
    const authForm = document.getElementById('auth-form');
    const authUsername = document.getElementById('auth-username');
    const authPassword = document.getElementById('auth-password');
    const authTitle = document.getElementById('auth-title');
    const authBtn = document.getElementById('auth-btn');
    const authError = document.getElementById('auth-error');
    const authToggleBtn = document.getElementById('auth-toggle-btn');
    const authToggleText = document.getElementById('auth-toggle-text');
    const usernameDisplay = document.getElementById('username-display');
    const btnLogout = document.getElementById('btn-logout');

    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const dropzoneIdle = document.getElementById('dropzone-idle');
    const dropzoneStaging = document.getElementById('dropzone-staging');
    const dropzoneProgress = document.getElementById('dropzone-progress');
    const progressTrack = document.getElementById('progress-track');
    const stageFileName = document.getElementById('stage-file-name');
    const stageFileSize = document.getElementById('stage-file-size');
    const btnStartUpload = document.getElementById('btn-start-upload');
    const btnCancelStage = document.getElementById('btn-cancel-stage');
    const progressFill = document.getElementById('progress-fill');
    const progressPercent = document.getElementById('progress-percent');

    const filesGrid = document.getElementById('files-grid');
    const emptyState = document.getElementById('empty-state');
    const statStorage = document.getElementById('stat-storage');
    const statCount = document.getElementById('stat-count');
    const searchInput = document.getElementById('search-input');

    const previewModal = document.getElementById('preview-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalBody = document.getElementById('modal-body');
    const modalFileTitle = document.getElementById('modal-file-title');

    const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // keep in sync with server config/env.js

    let isRegisterMode = false;
    let selectedFile = null;

    checkAuth();

    function authHeaders(extra = {}) {
        return session?.token ? { Authorization: `Bearer ${session.token}`, ...extra } : extra;
    }

    function checkAuth() {
        if (session?.user?.id && session?.token) {
            authScreen.classList.add('hidden');
            usernameDisplay.textContent = session.user.username;
            fetchFiles();
        } else {
            authScreen.classList.remove('hidden');
        }
    }

    function logout(message) {
        localStorage.removeItem('zerocloud_session');
        session = null;
        checkAuth();
        if (message) showToast(message, 'error');
    }

    // Toggle Login / Register
    authToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isRegisterMode = !isRegisterMode;
        hideAuthError();
        if (isRegisterMode) {
            authTitle.textContent = 'Create ZeroCloud Account';
            authBtn.textContent = 'Register Now';
            authToggleText.textContent = 'Pehle se account hai?';
            authToggleBtn.textContent = 'Login Karein';
        } else {
            authTitle.textContent = 'Welcome Back';
            authBtn.textContent = 'Login to Vault';
            authToggleText.textContent = 'Account nahi hai?';
            authToggleBtn.textContent = 'Register Karein';
        }
    });

    function showAuthError(msg) {
        authError.textContent = msg;
        authError.classList.remove('hidden');
    }
    function hideAuthError() {
        authError.classList.add('hidden');
    }

    // Auth Form Submit
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthError();
        const username = authUsername.value.trim();
        const password = authPassword.value;
        const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';

        authBtn.disabled = true;
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();
            if (data.success) {
                session = { user: data.user, token: data.token };
                localStorage.setItem('zerocloud_session', JSON.stringify(session));
                showToast(isRegisterMode ? 'Account Created!' : 'Login Successful!', 'success');
                checkAuth();
            } else {
                showAuthError(data.error || 'Authentication failed.');
            }
        } catch {
            showAuthError('Could not reach the server. Please try again.');
        } finally {
            authBtn.disabled = false;
        }
    });

    btnLogout.addEventListener('click', () => logout());

    // Helpers
    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str ?? '';
        return div.innerHTML;
    }

    // File Drag and Drop Logic
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('hover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('hover'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('hover');
        if (e.dataTransfer.files.length) handleStage(e.dataTransfer.files[0]);
    });

    // Click or keyboard (Enter/Space) opens the file picker — dropzone is a
    // role="button" element, so it needs both interaction paths for
    // accessibility, not just the mouse-only onclick it had before.
    dropzoneIdle.addEventListener('click', () => fileInput.click());
    dropzoneIdle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleStage(e.target.files[0]);
    });

    function handleStage(file) {
        if (file.size > MAX_UPLOAD_BYTES) {
            showToast(`File is too large. Max size is ${formatBytes(MAX_UPLOAD_BYTES)}.`, 'error');
            fileInput.value = '';
            return;
        }
        selectedFile = file;
        stageFileName.textContent = file.name;
        stageFileSize.textContent = formatBytes(file.size);
        dropzoneIdle.classList.add('hidden');
        dropzoneStaging.classList.remove('hidden');
    }

    btnCancelStage.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        dropzoneStaging.classList.add('hidden');
        dropzoneIdle.classList.remove('hidden');
    });

    btnStartUpload.addEventListener('click', () => {
        if (!selectedFile || !session?.token) return;

        const formData = new FormData();
        formData.append('file', selectedFile);

        dropzoneStaging.classList.add('hidden');
        dropzoneProgress.classList.remove('hidden');

        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = percent + '%';
                progressPercent.textContent = percent + '%';
                progressTrack.setAttribute('aria-valuenow', String(percent));
            }
        });

        xhr.addEventListener('load', () => {
            dropzoneProgress.classList.add('hidden');
            dropzoneIdle.classList.remove('hidden');
            progressFill.style.width = '0%';
            progressPercent.textContent = '0%';

            if (xhr.status >= 200 && xhr.status < 300) {
                showToast('File uploaded to Telegram Cloud!', 'success');
                selectedFile = null;
                fileInput.value = '';
                fetchFiles();
            } else if (xhr.status === 401) {
                logout('Your session expired. Please log in again.');
            } else {
                let message = 'Upload failed';
                try { message = JSON.parse(xhr.responseText).error || message; } catch { /* ignore */ }
                showToast(message, 'error');
            }
        });

        xhr.addEventListener('error', () => {
            dropzoneProgress.classList.add('hidden');
            dropzoneIdle.classList.remove('hidden');
            showToast('Network error during upload.', 'error');
        });

        xhr.open('POST', '/api/upload');
        xhr.setRequestHeader('Authorization', `Bearer ${session.token}`);
        xhr.send(formData);
    });

    // Fetch Files
    async function fetchFiles() {
        if (!session?.token) return;
        try {
            const res = await fetch('/api/files', { headers: authHeaders() });
            if (res.status === 401) return logout('Your session expired. Please log in again.');

            const data = await res.json();
            if (data.success) {
                state.files = data.files;
                statStorage.textContent = formatBytes(data.totalBytes);
                statCount.textContent = data.files.length;
                renderFiles();
            }
        } catch {
            showToast('Could not load your files.', 'error');
        }
    }

    // Filter Pills
    document.querySelectorAll('.pill').forEach((pill) => {
        pill.addEventListener('click', (e) => {
            document.querySelectorAll('.pill').forEach((p) => {
                p.classList.remove('active');
                p.setAttribute('aria-selected', 'false');
            });
            e.target.classList.add('active');
            e.target.setAttribute('aria-selected', 'true');
            state.activeCategory = e.target.dataset.cat;
            renderFiles();
        });
    });

    // Search Input
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        renderFiles();
    });

    // Render Files Grid
    function renderFiles() {
        filesGrid.innerHTML = '';

        const filtered = state.files.filter((f) => {
            const matchesCat = state.activeCategory === 'all' || f.category === state.activeCategory;
            const matchesSearch = f.originalName.toLowerCase().includes(state.searchQuery);
            return matchesCat && matchesSearch;
        });

        if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }
        emptyState.classList.add('hidden');

        filtered.forEach((file) => {
            filesGrid.appendChild(buildFileCard(file));
        });
    }

    // File cards are built with DOM APIs (not innerHTML + string
    // interpolation) so a filename like `<img src=x onerror=alert(1)>`
    // is rendered as inert text instead of executing as HTML/JS — this
    // was a stored-XSS hole in the previous version.
    function buildFileCard(file) {
        const previewUrl = `/api/preview/${encodeURIComponent(file.id)}`;
        const downloadUrl = `/api/download/${encodeURIComponent(file.id)}`;

        const card = document.createElement('div');
        card.className = 'file-card';

        const thumb = document.createElement('div');
        thumb.className = 'file-preview-thumb';
        thumb.setAttribute('role', 'button');
        thumb.tabIndex = 0;
        thumb.setAttribute('aria-label', `Preview ${file.originalName}`);
        thumb.addEventListener('click', () => openModal(file));
        thumb.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(file); }
        });

        if (file.category === 'images') {
            const img = document.createElement('img');
            img.src = previewUrl;
            img.loading = 'lazy';
            img.alt = file.originalName;
            thumb.appendChild(img);
        } else {
            const icon = document.createElement('i');
            icon.className =
                file.category === 'videos' ? 'fa-solid fa-circle-play' :
                file.category === 'audios' ? 'fa-solid fa-music' : 'fa-solid fa-file';
            if (file.category === 'audios') icon.style.color = 'var(--success-green)';
            icon.setAttribute('aria-hidden', 'true');
            thumb.appendChild(icon);
        }

        const title = document.createElement('div');
        title.className = 'file-title';
        title.title = file.originalName;
        title.textContent = file.originalName;

        const meta = document.createElement('div');
        meta.className = 'file-info-meta';
        meta.innerHTML = `<span>${escapeHtml(formatBytes(file.size))}</span><span>${escapeHtml(new Date(file.uploadTime).toLocaleDateString())}</span>`;

        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn btn-secondary';
        viewBtn.innerHTML = '<i class="fa-solid fa-eye" aria-hidden="true"></i> View';
        viewBtn.addEventListener('click', () => openModal(file));

        const downloadLink = document.createElement('a');
        downloadLink.className = 'btn btn-secondary';
        downloadLink.href = downloadUrl;
        downloadLink.setAttribute('download', '');
        downloadLink.setAttribute('aria-label', `Download ${file.originalName}`);
        downloadLink.innerHTML = '<i class="fa-solid fa-download" aria-hidden="true"></i>';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-secondary danger-btn';
        deleteBtn.setAttribute('aria-label', `Delete ${file.originalName}`);
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
        deleteBtn.addEventListener('click', () => deleteFile(file.id));

        actions.append(viewBtn, downloadLink, deleteBtn);
        card.append(thumb, title, meta, actions);
        return card;
    }

    // Modal In-Page Preview Logic (Fixes tab issue + video/audio sound)
    function openModal(file) {
        modalFileTitle.textContent = file.originalName;
        const previewUrl = `/api/preview/${encodeURIComponent(file.id)}`;
        modalBody.innerHTML = '';

        if (file.category === 'images') {
            const img = document.createElement('img');
            img.src = previewUrl;
            img.alt = file.originalName;
            modalBody.appendChild(img);
        } else if (file.category === 'videos') {
            const video = document.createElement('video');
            video.controls = true;
            video.autoplay = true;
            video.style.width = '100%';
            const source = document.createElement('source');
            source.src = previewUrl;
            source.type = file.mimeType || 'video/mp4';
            video.appendChild(source);
            modalBody.appendChild(video);
        } else if (file.category === 'audios') {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'text-align:center;width:100%;padding:20px;';
            wrap.innerHTML = '<i class="fa-solid fa-compact-disc fa-spin" style="font-size:60px;color:var(--success-green);margin-bottom:20px;" aria-hidden="true"></i>';
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.autoplay = true;
            audio.style.width = '100%';
            const source = document.createElement('source');
            source.src = previewUrl;
            source.type = file.mimeType || 'audio/mpeg';
            audio.appendChild(source);
            wrap.appendChild(audio);
            modalBody.appendChild(wrap);
        } else if (file.mimeType && file.mimeType.includes('pdf')) {
            const iframe = document.createElement('iframe');
            iframe.src = previewUrl;
            iframe.title = file.originalName;
            modalBody.appendChild(iframe);
        } else {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'text-align:center;padding:20px;';
            wrap.innerHTML = `
                <i class="fa-solid fa-file-arrow-down" style="font-size:50px;color:var(--accent-blue);margin-bottom:15px;" aria-hidden="true"></i>
                <p>Live preview available nahi hai.</p>`;
            const link = document.createElement('a');
            link.href = `/api/download/${encodeURIComponent(file.id)}`;
            link.className = 'btn btn-glow';
            link.style.marginTop = '15px';
            link.setAttribute('download', '');
            link.textContent = 'Download File';
            wrap.appendChild(link);
            modalBody.appendChild(wrap);
        }

        previewModal.classList.remove('hidden');
        modalCloseBtn.focus();
    }

    function closeModal() {
        previewModal.classList.add('hidden');
        modalBody.innerHTML = '';
    }

    modalCloseBtn.addEventListener('click', closeModal);
    previewModal.addEventListener('click', (e) => { if (e.target === previewModal) closeModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !previewModal.classList.contains('hidden')) closeModal();
    });

    // Delete File
    async function deleteFile(id) {
        if (!confirm('Kya aap is file ko Vault se delete karna chahte hain?')) return;
        try {
            const res = await fetch(`/api/delete/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (res.status === 401) return logout('Your session expired. Please log in again.');

            const data = await res.json();
            if (data.success) {
                showToast('File deleted', 'success');
                fetchFiles();
            } else {
                showToast(data.error || 'Delete failed', 'error');
            }
        } catch {
            showToast('Delete failed', 'error');
        }
    }

    function showToast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
});
