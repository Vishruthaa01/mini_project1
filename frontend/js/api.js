const API_BASE = 'http://localhost:5000/api';

async function apiRequest(path, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };

    const token = localStorage.getItem('token');

    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }

    const response = await fetch(API_BASE + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
    } return data;
}

function resolvePath(target) {
    const p = window.location.pathname.replace(/\\/g, '/');
    const isInSubdir = p.includes('/authentication/') || p.includes('/vendor/') || p.includes('/buyer/');
    return isInSubdir ? '../' + target : target;
}

function saveSession(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
}

function goToProfileSetup(user) {
    if (!user) return;
    if (user.role === 'vendor') {
        window.location.href = resolvePath('vendor/vendor-profile.html?setup=true');
    } else {
        window.location.href = resolvePath('buyer/buyer-profile.html?setup=true');
    }
}

function goToDashboard(user) {
    if (!user) return;
    if (user.isProfileComplete === false) {
        goToProfileSetup(user);
        return;
    }

    if (user.role === 'vendor') {
        window.location.href = resolvePath('vendor/vendor.html');
    } else {
        // Buyers go to the marketplace, not homepage
        window.location.href = resolvePath('buyer/marketplace.html');
    }
}

// Safely escape text so it can be set as innerHTML without XSS risk
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Returns total item count in the cart (for the nav badge)
function getCartCount() {
    try {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        return cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
    } catch (e) {
        return 0;
    }
}

function requireAuth(allowedRole = null, requireProfile = true) {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        window.location.href = resolvePath('authentication/login.html');
        return null;
    }

    const user = JSON.parse(userStr);

    if (allowedRole && user.role !== allowedRole) {
        goToDashboard(user);
        return null;
    }

    if (requireProfile && user.isProfileComplete === false) {
        goToProfileSetup(user);
        return null;
    }

    return user;
}