// ============================================
// JobShield — History Page Logic
// ============================================
const API_BASE = '/api';

async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/stats`);
        const json = await res.json();
        if (!json.success) return;

        document.getElementById('statTotal').textContent = json.data.total;

        const breakdown = { REAL: 0, SUSPICIOUS: 0, FAKE: 0 };
        json.data.breakdown.forEach(row => { breakdown[row.verdict] = row.count; });

        document.getElementById('statReal').textContent = breakdown.REAL;
        document.getElementById('statSuspicious').textContent = breakdown.SUSPICIOUS;
        document.getElementById('statFake').textContent = breakdown.FAKE;
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

async function loadHistory() {
    const tbody = document.getElementById('historyBody');
    try {
        const res = await fetch(`${API_BASE}/history?limit=100`);
        const json = await res.json();

        if (!json.success || json.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="loading-row">No scans yet. Go scan a job post!</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        json.data.forEach((row, idx) => {
            const tr = document.createElement('tr');
            tr.dataset.id = row.id;
            tr.classList.add('history-row-clickable');
            tr.title = 'Click to view the full scan';
            const tagClass = row.verdict === 'REAL' ? 'tag-real' : row.verdict === 'SUSPICIOUS' ? 'tag-suspicious' : 'tag-fake';
            const date = new Date(row.created_at).toLocaleString();

            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td>${row.input_type === 'image' ? '🖼 Image' : '✎ Text'}</td>
                <td>${escapeHtml(row.company_name || '—')}</td>
                <td>${escapeHtml(row.preview)}${row.preview.length >= 150 ? '…' : ''}</td>
                <td><strong>${row.risk_score}</strong>/100</td>
                <td><span class="verdict-tag ${tagClass}">${row.verdict}</span></td>
                <td>${date}</td>
                <td><button class="delete-btn" data-id="${row.id}" title="Delete this scan">🗑 Delete</button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-row">Could not load history. Is the backend running?</td></tr>';
        console.error(err);
    }
}

// ------------------------------------------------
// Delete a scan (row + its image + its result, all
// live on the same scan_history row on the backend).
// Event delegation so it works for rows added after
// the initial render too.
// ------------------------------------------------
// ------------------------------------------------
// Row click → open the Scan Detail modal, showing
// the original image (if it was an image scan) or
// the original pasted text (if it was a text scan).
// ------------------------------------------------
document.getElementById('historyBody').addEventListener('click', (e) => {
    if (e.target.closest('.delete-btn')) return; // let the delete handler below deal with it
    const tr = e.target.closest('tr');
    if (!tr || !tr.dataset.id) return;
    openHistoryModal(tr.dataset.id);
});

async function openHistoryModal(id) {
    const modal = document.getElementById('historyModal');
    const metaEl = document.getElementById('modalMeta');
    const contentEl = document.getElementById('modalContent');

    metaEl.innerHTML = '';
    contentEl.innerHTML = '<p class="loading-row">Loading…</p>';
    modal.classList.remove('hidden');

    try {
        const res = await fetch(`${API_BASE}/history/${id}`);
        const json = await res.json();

        if (!json.success) {
            contentEl.innerHTML = `<p>${escapeHtml(json.message || 'Could not load this scan.')}</p>`;
            return;
        }

        const data = json.data;
        const date = new Date(data.created_at).toLocaleString();
        const tagClass = data.verdict === 'REAL' ? 'tag-real' : data.verdict === 'SUSPICIOUS' ? 'tag-suspicious' : 'tag-fake';

        metaEl.innerHTML = `
            <p><strong>Company:</strong> ${escapeHtml(data.company_name || '—')}</p>
            <p><strong>Risk Score:</strong> ${data.risk_score}/100 &nbsp; <span class="verdict-tag ${tagClass}">${data.verdict}</span></p>
            <p><strong>Scanned On:</strong> ${date}</p>
        `;

        if (data.input_type === 'image' && data.image_path) {
            // Image scan: show the original screenshot, and the OCR text pulled from it
            contentEl.innerHTML = `
                <img src="/uploads/${data.image_path}" alt="Scanned screenshot" class="modal-image" />
                <p class="modal-subhead">Text extracted from this image (OCR):</p>
                <pre class="modal-text">${escapeHtml(data.original_text)}</pre>
            `;
        } else {
            // Text scan: show the original pasted text
            contentEl.innerHTML = `<pre class="modal-text">${escapeHtml(data.original_text)}</pre>`;
        }
    } catch (err) {
        contentEl.innerHTML = '<p>Could not reach the server.</p>';
        console.error(err);
    }
}

function closeHistoryModal() {
    document.getElementById('historyModal').classList.add('hidden');
}

document.getElementById('modalClose').addEventListener('click', closeHistoryModal);
document.getElementById('historyModal').addEventListener('click', (e) => {
    if (e.target.id === 'historyModal') closeHistoryModal(); // click on the dark backdrop
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeHistoryModal();
});

document.getElementById('historyBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;

    const id = btn.dataset.id;
    const confirmed = window.confirm('Delete this scan? Its image and result will be removed too. This cannot be undone.');
    if (!confirmed) return;

    btn.disabled = true;
    btn.textContent = 'Deleting…';

    try {
        const res = await fetch(`${API_BASE}/history/${id}`, { method: 'DELETE' });
        const json = await res.json();

        if (json.success) {
            await loadHistory();
            await loadStats();
        } else {
            alert(json.message || 'Could not delete this scan.');
            btn.disabled = false;
            btn.textContent = '🗑 Delete';
        }
    } catch (err) {
        alert('Could not reach the server.');
        console.error(err);
        btn.disabled = false;
        btn.textContent = '🗑 Delete';
    }
});

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

loadStats();
loadHistory();
