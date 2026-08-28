// ============================================
// JobShield — Company Registry Page Logic
// ============================================
const API_BASE = '/api';

async function loadCompanies() {
    const grid = document.getElementById('companyGrid');
    try {
        const res = await fetch(`${API_BASE}/companies`);
        const json = await res.json();

        if (!json.success || json.data.length === 0) {
            grid.innerHTML = '<p class="loading-row">No companies in the registry yet.</p>';
            return;
        }

        grid.innerHTML = '';
        json.data.forEach(c => {
            const pillClass = c.status === 'trusted' ? 'pill-trusted' : c.status === 'blacklisted' ? 'pill-blacklisted' : 'pill-unknown';
            const card = document.createElement('div');
            card.className = 'company-card';
            card.innerHTML = `
                <span class="company-status-pill ${pillClass}">${c.status}</span>
                <div class="company-card-name">${escapeHtml(c.company_name)}</div>
                ${c.official_domain ? `<div class="company-card-domain">${escapeHtml(c.official_domain)}</div>` : ''}
                ${c.notes ? `<div class="company-card-notes">${escapeHtml(c.notes)}</div>` : ''}
            `;

            // Click-to-official-link: if this company has an official_domain,
            // clicking the card opens it in a new tab.
            if (c.official_domain) {
                card.classList.add('company-card-clickable');
                card.style.cursor = 'pointer';
                card.title = `Open ${c.official_domain}`;
                card.addEventListener('click', () => {
                    openOfficialLink(c.official_domain);
                });
            }

            grid.appendChild(card);
        });
    } catch (err) {
        grid.innerHTML = '<p class="loading-row">Could not load registry. Is the backend running?</p>';
        console.error(err);
    }
}

// Opens a company's official domain in a new tab.
// Domains in the DB may be stored without a protocol (e.g. "google.com"),
// so this normalizes them before opening.
function openOfficialLink(domain) {
    if (!domain) return;
    const url = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

loadCompanies();
