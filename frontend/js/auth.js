// ============================================
// JobShield — Auth Page Logic (Login / Signup / Forgot)
// Demo-grade client-side auth. Accounts are kept in
// localStorage under 'jobshield_users' so this works
// without touching the scan_history / known_companies
// backend tables. Swap for a real /api/auth backend
// when this project graduates past the demo stage.
// ============================================

const USERS_KEY   = 'jobshield_users';
const SESSION_KEY  = 'jobshield_authed_user';

function loadUsers() {
    try {
        const raw = localStorage.getItem(USERS_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore corrupt data */ }
    const seed = { admin: '1234' }; // demo account: admin / 1234
    localStorage.setItem(USERS_KEY, JSON.stringify(seed));
    return seed;
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function setMsg(el, text, type) {
    el.textContent = text;
    el.className = 'auth-msg ' + (type || '');
}

// ---------------- Radar sweep background ----------------
(function radarBackground() {
    const canvas = document.getElementById('radarBg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, cx, cy, radius, angle = 0;

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
        cx = w / 2;
        cy = h / 2;
        radius = Math.max(w, h) * 0.75;
    }
    window.addEventListener('resize', resize);
    resize();

    const ringCount = 5;

    function draw() {
        ctx.fillStyle = '#0B0E14';
        ctx.fillRect(0, 0, w, h);

        // concentric scan rings
        ctx.strokeStyle = 'rgba(242, 169, 59, 0.10)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= ringCount; i++) {
            ctx.beginPath();
            ctx.arc(cx, cy, (radius / ringCount) * i, 0, Math.PI * 2);
            ctx.stroke();
        }

        // faint crosshair
        ctx.strokeStyle = 'rgba(154, 160, 174, 0.06)';
        ctx.beginPath();
        ctx.moveTo(0, cy); ctx.lineTo(w, cy);
        ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
        ctx.stroke();

        // rotating sweep beam
        const grad = ctx.createConicGradient
            ? ctx.createConicGradient(angle, cx, cy)
            : null;

        if (grad) {
            grad.addColorStop(0, 'rgba(242, 169, 59, 0.28)');
            grad.addColorStop(0.06, 'rgba(242, 169, 59, 0.10)');
            grad.addColorStop(0.14, 'rgba(242, 169, 59, 0)');
            grad.addColorStop(1, 'rgba(242, 169, 59, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fill();
        } else {
            // fallback for browsers without conic gradients: a simple beam wedge
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            const wedge = ctx.createLinearGradient(0, 0, radius, 0);
            wedge.addColorStop(0, 'rgba(242, 169, 59, 0.25)');
            wedge.addColorStop(1, 'rgba(242, 169, 59, 0)');
            ctx.fillStyle = wedge;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, -0.18, 0.18);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        angle += 0.012;
        requestAnimationFrame(draw);
    }
    draw();
})();

// ---------------- Form wiring (only runs on login.html) ----------------
const loginForm  = document.getElementById('loginForm');
if (loginForm) {
    const signupForm = document.getElementById('signupForm');
    const forgotForm = document.getElementById('forgotForm');
    const showSignup = document.getElementById('showSignup');
    const showLogin  = document.getElementById('showLogin');
    const forgotBtn  = document.getElementById('forgotBtn');
    const backToLogin = document.getElementById('backToLogin');
    const authTitle = document.getElementById('authTitle');
    const authSub   = document.getElementById('authSub');
    const authEyebrow = document.getElementById('authEyebrow');

    function showForm(form) {
        [loginForm, signupForm, forgotForm].forEach(f => f.hidden = true);
        form.hidden = false;
        if (form === loginForm) {
            authEyebrow.textContent = 'Access Console';
            authTitle.textContent = 'Welcome back.';
            authSub.textContent = 'Sign in to run scans and review the audit trail.';
        } else if (form === signupForm) {
            authEyebrow.textContent = 'New Account';
            authTitle.textContent = 'Create your account.';
            authSub.textContent = 'Sign up to start scanning job posts for scam signals.';
        } else {
            authEyebrow.textContent = 'Recovery';
            authTitle.textContent = 'Reset password.';
            authSub.textContent = 'Verify your username and set a new password.';
        }
    }

    showSignup.addEventListener('click', () => showForm(signupForm));
    showLogin.addEventListener('click', () => showForm(loginForm));
    forgotBtn.addEventListener('click', () => showForm(forgotForm));
    backToLogin.addEventListener('click', () => showForm(loginForm));

    // LOGIN
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const users = loadUsers();
        const u = document.getElementById('loginUser').value.trim();
        const p = document.getElementById('loginPass').value;
        const msg = document.getElementById('loginMsg');

        if (users.hasOwnProperty(u) && users[u] === p) {
            sessionStorage.setItem(SESSION_KEY, u);
            setMsg(msg, '✔ Login successful. Redirecting…', 'success');
            setTimeout(() => { window.location.href = 'index.html'; }, 500);
        } else if (users.hasOwnProperty(u)) {
            setMsg(msg, '✖ Incorrect password. Try again.', 'error');
        } else {
            setMsg(msg, '✖ No account with that username. Sign up first.', 'error');
        }
    });

    // SIGN UP
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const users = loadUsers();
        const u  = document.getElementById('signUser').value.trim();
        const p  = document.getElementById('signPass').value;
        const p2 = document.getElementById('signPass2').value;
        const msg = document.getElementById('signupMsg');

        if (u.length < 3) return setMsg(msg, '✖ Username must be at least 3 characters.', 'error');
        if (users.hasOwnProperty(u)) return setMsg(msg, '✖ That username is already taken.', 'error');
        if (p.length < 4) return setMsg(msg, '✖ Password must be at least 4 characters.', 'error');
        if (p !== p2) return setMsg(msg, '✖ Passwords do not match.', 'error');

        users[u] = p;
        saveUsers(users);
        setMsg(msg, '✔ Account created. You can log in now.', 'success');
        signupForm.reset();
        setTimeout(() => showForm(loginForm), 900);
    });

    // FORGOT PASSWORD
    forgotForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const users = loadUsers();
        const u = document.getElementById('forgotUser').value.trim();
        const np = document.getElementById('newPass').value;
        const msg = document.getElementById('forgotMsg');

        if (!users.hasOwnProperty(u)) return setMsg(msg, '✖ No account with that username.', 'error');
        if (np.length < 4) return setMsg(msg, '✖ Password must be at least 4 characters.', 'error');

        users[u] = np;
        saveUsers(users);
        setMsg(msg, '✔ Password updated. You can log in now.', 'success');
        forgotForm.reset();
        setTimeout(() => showForm(loginForm), 900);
    });
}
