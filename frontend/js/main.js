// ============================================
// JobShield — Main Scanner Logic
// ============================================
const API_BASE = '/api';

// ---------- Tab switching ----------
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

function activateTab(tabName) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (!btn) return;
    tabBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
    tabPanels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    document.getElementById(`panel-${tabName}`).classList.add('active');
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

// Deep-link support: scanner.html#image opens straight on the OCR/image tab
// (used by the "OCR & Image Processing" module card on the home page)
const initialTab = window.location.hash.replace('#', '');
if (initialTab === 'image' || initialTab === 'text') {
    activateTab(initialTab);
}

// ---------- Char counter ----------
const jobText = document.getElementById('jobText');
const charCount = document.getElementById('charCount');
jobText.addEventListener('input', () => {
    charCount.textContent = `${jobText.value.length} characters`;
});

// ---------- Dropzone / image upload ----------
const dropzone = document.getElementById('dropzone');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const dropzoneContent = document.getElementById('dropzoneContent');
const fileNameLabel = document.getElementById('fileNameLabel');
const scanImageBtn = document.getElementById('scanImageBtn');
let selectedFile = null;

dropzone.addEventListener('click', () => imageInput.click());

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFileSelect(e.dataTransfer.files[0]);
    }
});

imageInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFileSelect(e.target.files[0]);
});

function handleFileSelect(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file (jpg, png, webp).');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        alert('File too large. Max size is 5MB.');
        return;
    }
    selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.hidden = false;
        dropzoneContent.hidden = true;
    };
    reader.readAsDataURL(file);

    fileNameLabel.textContent = file.name;
    scanImageBtn.disabled = false;
}

// ---------- Scan Text ----------
const scanTextBtn = document.getElementById('scanTextBtn');
scanTextBtn.addEventListener('click', async () => {
    const text = jobText.value.trim();
    if (!text) {
        alert('Please paste a job or internship description first.');
        return;
    }

    showLoading('Scanning for red flags…');

    try {
        const res = await fetch(`${API_BASE}/scan/text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobText: text })
        });
        const json = await res.json();
        hideLoading();

        if (!json.success) {
            alert(json.message || 'Something went wrong.');
            return;
        }
        renderResult(json.data);
    } catch (err) {
        hideLoading();
        alert('Could not reach the server. Is the backend running?');
        console.error(err);
    }
});

// ---------- Scan Image ----------
scanImageBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    showLoading('Reading text from image (OCR)…');

    const formData = new FormData();
    formData.append('jobImage', selectedFile);

    try {
        const res = await fetch(`${API_BASE}/scan/image`, {
            method: 'POST',
            body: formData
        });
        const json = await res.json();
        hideLoading();

        if (!json.success) {
            alert(json.message || 'Something went wrong.');
            return;
        }
        renderResult(json.data, true);
    } catch (err) {
        hideLoading();
        alert('Could not reach the server. Is the backend running?');
        console.error(err);
    }
});

// ---------- Loading state ----------
const loadingCard = document.getElementById('loadingCard');
const loadingText = document.getElementById('loadingText');
const resultCard = document.getElementById('resultCard');
const scannerCard = document.querySelector('.scanner-card');

function showLoading(msg) {
    loadingText.textContent = msg;
    loadingCard.hidden = false;
    resultCard.hidden = true;
    scannerCard.style.display = 'none';
}
function hideLoading() {
    loadingCard.hidden = true;
}

// ---------- Render Result ----------
function renderResult(data, isImage = false) {
    resultCard.hidden = false;

    const verdictBanner = document.getElementById('verdictBanner');
    const verdictIcon = document.getElementById('verdictIcon');
    const verdictTitle = document.getElementById('verdictTitle');
    const verdictSubtitle = document.getElementById('verdictSubtitle');
    const ringFill = document.getElementById('ringFill');
    const riskScoreNum = document.getElementById('riskScoreNum');

    const verdictConfig = {
        REAL: { icon: '✅', cls: 'real', color: '#4FD1A5', title: 'Looks Legitimate', sub: 'No major red flags detected. Still verify independently before sharing personal details.' },
        SUSPICIOUS: { icon: '⚠️', cls: 'suspicious', color: '#F2A93B', title: 'Proceed with Caution', sub: 'Some warning signs found. Verify the company and avoid any upfront payments.' },
        FAKE: { icon: '🛑', cls: 'fake', color: '#F2495C', title: 'High Risk of Being Fake', sub: 'Multiple strong red flags detected. We recommend NOT proceeding with this post.' }
    };

    const cfg = verdictConfig[data.verdict] || verdictConfig.SUSPICIOUS;

    verdictBanner.className = `verdict-banner ${cfg.cls}`;
    verdictIcon.textContent = cfg.icon;
    verdictTitle.textContent = cfg.title;
    verdictSubtitle.textContent = cfg.sub;

    riskScoreNum.textContent = data.risk_score;
    ringFill.style.stroke = cfg.color;
    const circumference = 314;
    const offset = circumference - (circumference * data.risk_score) / 100;
    setTimeout(() => { ringFill.style.strokeDashoffset = offset; }, 100);

    // Company check
    const companyCheckBody = document.getElementById('companyCheckBody');
    const cc = data.company_check;
    if (cc && cc.matched) {
        const pillClass = cc.status === 'trusted' ? 'pill-trusted' : cc.status === 'blacklisted' ? 'pill-blacklisted' : 'pill-unknown';
        companyCheckBody.innerHTML = `
            <span class="company-status-pill ${pillClass}">${cc.status}</span>
            <p><strong>${escapeHtml(cc.company_name)}</strong></p>
            ${cc.official_domain ? `<p>Official domain: <code class="domain-link" title="Open ${escapeHtml(cc.official_domain)}">${escapeHtml(cc.official_domain)}</code></p>` : ''}
            ${cc.notes ? `<p>${escapeHtml(cc.notes)}</p>` : ''}
        `;

        // Click-to-official-link: open the verified company's real site in a new tab
        if (cc.official_domain) {
            const domainEl = companyCheckBody.querySelector('.domain-link');
            domainEl.style.cursor = 'pointer';
            domainEl.addEventListener('click', () => openOfficialLink(cc.official_domain));
        }
    } else {
        const guess = data.company_guess ? ` (possibly "${escapeHtml(data.company_guess)}")` : '';
        companyCheckBody.innerHTML = `
            <span class="company-status-pill pill-unknown">unverified</span>
            <p>This company isn't in our safety registry${guess}. That doesn't confirm it's fake — just unverified. Search for it independently.</p>
        `;
    }

    // Flags list
    const flagsList = document.getElementById('flagsList');
    flagsList.innerHTML = '';
    if (!data.matched_flags || data.matched_flags.length === 0) {
        flagsList.innerHTML = '<li class="flag-empty">No red flags found in this post.</li>';
    } else {
        data.matched_flags
            .filter(f => f.weight > 0) // don't show the "trusted company" negative-weight as a flag
            .sort((a, b) => b.weight - a.weight)
            .forEach(flag => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${escapeHtml(flag.match)}</span><span class="flag-category">${escapeHtml(flag.category)}</span>`;
                flagsList.appendChild(li);
            });
        if (flagsList.children.length === 0) {
            flagsList.innerHTML = '<li class="flag-empty">No red flags found in this post.</li>';
        }
    }

    // Extracted text block (only for image scans)
    const extractedTextBlock = document.getElementById('extractedTextBlock');
    if (isImage && data.extracted_text) {
        document.getElementById('extractedTextBody').textContent = data.extracted_text;
        extractedTextBlock.hidden = false;
    } else {
        extractedTextBlock.hidden = true;
    }

    // Safety tips
    const safetyTips = document.getElementById('safetyTips');
    safetyTips.innerHTML = `
        <strong>Stay safe — quick checklist:</strong>
        <ul>
            <li>Legitimate employers never ask you to pay for registration, training kits, or "refundable" deposits.</li>
            <li>Verify the company's official website and careers page directly — don't trust links sent over WhatsApp/Telegram.</li>
            <li>Be wary of offers with no interview, instant selection, or unusually high pay for unskilled work.</li>
            <li>Never share OTPs, bank details, or Aadhar scans before formally joining a verified company.</li>
        </ul>
    `;

    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Opens a company's official domain in a new tab.
// Domains may be stored without a protocol (e.g. "google.com"),
// so this normalizes them before opening.
function openOfficialLink(domain) {
    if (!domain) return;
    const url = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

// ---------- Scan Another ----------
document.getElementById('scanAnotherBtn').addEventListener('click', () => {
    resultCard.hidden = true;
    scannerCard.style.display = '';
    jobText.value = '';
    charCount.textContent = '0 characters';
    selectedFile = null;
    imagePreview.hidden = true;
    dropzoneContent.hidden = false;
    fileNameLabel.textContent = '';
    scanImageBtn.disabled = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
});
