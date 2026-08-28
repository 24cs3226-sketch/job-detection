// ============================================
// JobShield — Auth Guard
// Included on every app page (index/scanner/history/companies).
// Redirects to login.html if there is no active session, and
// wires up the "Logout" nav link.
// ============================================
(function () {
    const SESSION_KEY = 'jobshield_authed_user';
    const user = sessionStorage.getItem(SESSION_KEY);

    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const navLinks = document.querySelector('.nav-links');
        if (!navLinks) return;

        const logout = document.createElement('a');
        logout.href = '#';
        logout.className = 'nav-link logout';
        logout.textContent = `Logout (${user})`;
        logout.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem(SESSION_KEY);
            window.location.href = 'login.html';
        });
        navLinks.appendChild(logout);
    });
})();
