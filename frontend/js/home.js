// ============================================
// JobShield — Home Page Logic
// Fetches live stats from the same MySQL-backed
// /api/stats endpoint used on the History page.
// ============================================
const API_BASE = '/api';

async function loadHomeStats() {
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
        // Backend not running yet / no scans logged — show zeros instead of a broken UI
        ['statTotal', 'statReal', 'statSuspicious', 'statFake'].forEach(id => {
            document.getElementById(id).textContent = '0';
        });
        console.warn('Could not load stats (is the backend running?):', err.message);
    }
}

document.addEventListener('DOMContentLoaded', loadHomeStats);
