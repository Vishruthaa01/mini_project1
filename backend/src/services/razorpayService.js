const crypto = require('crypto');
const Razorpay = require('razorpay');

const DEMO_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');
const demoOrders = new Map();
const demoPayments = new Map();

function trimEnv(name) {
    return (process.env[name] || '').trim();
}

function isRealConfigured() {
    const keyId = trimEnv('RAZORPAY_KEY_ID');
    const keySecret = trimEnv('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) return false;
    if (keyId === 'rzp_test_your_key_id' || keySecret === 'your_test_key_secret') return false;
    return true;
}

function isDemoMode() {
    if (isRealConfigured()) return false;
    return trimEnv('RAZORPAY_DEMO_MODE').toLowerCase() === 'true';
}

function isConfigured() {
    return isRealConfigured() || isDemoMode();
}

function getActiveSecret() {
    if (isRealConfigured()) {
        return trimEnv('RAZORPAY_KEY_SECRET');
    }
    if (isDemoMode()) {
        const baseSecret = trimEnv('JWT_SECRET') || DEMO_FALLBACK_SECRET;
        return crypto.createHash('sha256').update(`vendorconnect-razorpay-demo:${baseSecret}`).digest('hex');
    }
    const error = new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    error.statusCode = 503;
    throw error;
}

function pruneMap(map, maxEntries = 500) {
    while (map.size > maxEntries) {
        const oldestKey = map.keys().next().value;
        map.delete(oldestKey);
    }
}

function extractErrorMessage(err, fallback = 'Payment gateway error') {
    if (!err) return fallback;
    if (err.error && typeof err.error.description === 'string' && err.error.description.trim()) {
        return err.error.description.trim();
    }
    if (typeof err.message === 'string' && err.message.trim()) {
        return err.message.trim();
    }
    return fallback;
}

function getClient() {
    if (!isRealConfigured()) {
        const error = new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
        error.statusCode = 503;
        throw error;
    }

    return new Razorpay({
        key_id: trimEnv('RAZORPAY_KEY_ID'),
        key_secret: trimEnv('RAZORPAY_KEY_SECRET')
    });
}

function getKeyId() {
    if (isDemoMode()) {
        return 'rzp_test_local_simulator';
    }
    getClient();
    return trimEnv('RAZORPAY_KEY_ID');
}

function verifySignature(orderId, paymentId, signature) {
    if (!isConfigured()) {
        const error = new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
        error.statusCode = 503;
        throw error;
    }

    if (typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof signature !== 'string') {
        return false;
    }

    const expected = crypto
        .createHmac('sha256', getActiveSecret())
        .update(`${orderId}|${paymentId}`)
        .digest();

    let received;
    try {
        received = Buffer.from(signature, 'hex');
    } catch (error) {
        return false;
    }

    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

async function createOrder(amount, buyerId) {
    if (!isConfigured()) {
        const error = new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
        error.statusCode = 503;
        throw error;
    }

    if (isDemoMode()) {
        const id = `order_demo_${crypto.randomBytes(8).toString('hex')}`;
        const order = {
            id,
            amount,
            currency: 'INR',
            receipt: `vc_demo_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            status: 'created',
            notes: { buyerId: buyerId.toString() },
            demoMode: true
        };
        demoOrders.set(id, order);
        pruneMap(demoOrders);
        return order;
    }

    return getClient().orders.create({
        amount,
        currency: 'INR',
        receipt: `vc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        notes: { buyerId: buyerId.toString() }
    });
}

function createDemoPayment(orderId, amount, method = 'upi') {
    if (!isDemoMode()) {
        const error = new Error('Local demo simulator is only available when RAZORPAY_DEMO_MODE=true and API keys are unset.');
        error.statusCode = 403;
        throw error;
    }

    const existing = [...demoPayments.values()].find(
        p => p.order_id === orderId && p.amount === amount && p.currency === 'INR' && p.status === 'captured'
    );
    const payment = existing || {
        id: `pay_demo_${crypto.randomBytes(8).toString('hex')}`,
        order_id: orderId,
        amount,
        currency: 'INR',
        status: 'captured',
        method: typeof method === 'string' && method.trim() ? method.trim() : 'upi',
        created_at: Math.floor(Date.now() / 1000)
    };

    if (!existing) {
        demoPayments.set(payment.id, payment);
        pruneMap(demoPayments);
    }

    const signature = crypto
        .createHmac('sha256', getActiveSecret())
        .update(`${orderId}|${payment.id}`)
        .digest('hex');

    return {
        razorpay_order_id: orderId,
        razorpay_payment_id: payment.id,
        razorpay_signature: signature,
        payment
    };
}

async function fetchOrderPayments(orderId) {
    if (isDemoMode()) {
        const items = [...demoPayments.values()].filter(p => p.order_id === orderId);
        return { entity: 'collection', count: items.length, items };
    }
    return getClient().orders.fetchPayments(orderId);
}

async function fetchPayment(paymentId) {
    if (isDemoMode()) {
        const payment = demoPayments.get(paymentId);
        if (!payment) {
            const error = new Error('Simulated Razorpay payment not found');
            error.statusCode = 404;
            throw error;
        }
        return payment;
    }
    return getClient().payments.fetch(paymentId);
}

async function capturePayment(paymentId, amount) {
    if (isDemoMode()) {
        const payment = await fetchPayment(paymentId);
        if (payment.amount !== amount) {
            const error = new Error('Payment amount mismatch');
            error.statusCode = 400;
            throw error;
        }
        payment.status = 'captured';
        return payment;
    }
    return getClient().payments.capture(paymentId, amount, 'INR');
}

module.exports = {
    isRealConfigured,
    isDemoMode,
    isConfigured,
    extractErrorMessage,
    getKeyId,
    verifySignature,
    createOrder,
    createDemoPayment,
    fetchOrderPayments,
    fetchPayment,
    capturePayment
};
