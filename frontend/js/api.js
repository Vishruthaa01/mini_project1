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

function saveSession(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
}

function goToDashboard(user) {
    if (user.role === 'vendor') {
        window.location.href = '../vendor/vendor.html';
    } else {
        window.location.href = '../index.html';
    }
}