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
        // If request carried a token and received 401 (not an auth endpoint itself), session is expired
        const isAuthEndpoint = path.startsWith('/auth/login') || path.startsWith('/auth/signup');
        if (token && response.status === 401 && !isAuthEndpoint) {
            localStorage.clear();
            sessionStorage.setItem('session_expired_msg', 'Your session has expired. Please log in again.');
            window.location.href = resolvePath('authentication/login.html?expired=1');
            return;
        }
        throw new Error(data.message || 'Something went wrong');
    }
    return data;
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
    if (user.role === 'admin') {
        window.location.href = resolvePath('admin/index.html');
        return;
    }
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

// Automatically populates notification badges for pending orders and open inquiries in vendor navbar
async function updateVendorNavBadges() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    try {
        const user = JSON.parse(userStr);
        if (user.role !== 'vendor') return;

        const [orders, inquiries] = await Promise.all([
            apiRequest('/orders/vendor', 'GET').catch(() => []),
            apiRequest('/inquiries/vendor', 'GET').catch(() => [])
        ]);

        const pendingCount = (orders || []).filter(o => ['Placed', 'Confirmed', 'Processing'].includes(o.orderStatus)).length;
        const openCount = (inquiries || []).filter(i => i.status === 'Open' || !i.vendorReply).length;

        const pendingBadge = document.getElementById('pendingOrdersNavBadge');
        if (pendingBadge) {
            if (pendingCount > 0) {
                pendingBadge.textContent = pendingCount;
                pendingBadge.classList.remove('d-none');
            } else {
                pendingBadge.classList.add('d-none');
            }
        }

        const inquiryBadge = document.getElementById('openInquiriesNavBadge');
        if (inquiryBadge) {
            if (openCount > 0) {
                inquiryBadge.textContent = openCount;
                inquiryBadge.classList.remove('d-none');
            } else {
                inquiryBadge.classList.add('d-none');
            }
        }
    } catch (e) {
        // Silently tolerate if offline or network fails
    }
}