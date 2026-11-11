/**
 * Razorpay Payment Gateway Integration Test Suite
 * -----------------------------------------------
 * Tests signature verification, order creation, capture, cancellation,
 * inventory management, HTTP route auth & middleware, and idempotency.
 */

const crypto = require('crypto');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Ensure env variables for test
process.env.PORT = '5001';
const rawTestMongoUri = process.env.TEST_MONGO_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vendorconnect_test';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/[a-zA-Z0-9_-]*test/i.test(rawTestMongoUri)) {
    throw new Error(`Refusing to run destructive test cleanup against non-test MongoDB URI: ${rawTestMongoUri}`);
}
process.env.MONGO_URI = rawTestMongoUri;
process.env.JWT_SECRET = 'test_jwt_secret_xyz123';
process.env.RAZORPAY_KEY_ID = 'rzp_test_mockKeyId1234';
process.env.RAZORPAY_KEY_SECRET = 'mockKeySecret567890abcdef';
process.env.RAZORPAY_DEMO_MODE = 'false';

const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const razorpayService = require('../src/services/razorpayService');
const orderRoutes = require('../src/routes/orderRoutes');
const adminRoutes = require('../src/routes/adminRoutes');

let server;
let baseUrl;
let mockBuyer, mockVendor, mockAdmin, mockProduct;
let buyerToken, vendorToken, adminToken;

function signToken(user) {
    return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function apiCall(path, method, token, body) {
    const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

async function runTests() {
    console.log('=== Starting Razorpay HTTP & Integration Test Suite ===\n');
    let passed = 0;
    let failed = 0;

    function assert(condition, testName) {
        if (condition) {
            console.log(`  ✓ PASS: ${testName}`);
            passed++;
        } else {
            console.error(`  ✗ FAIL: ${testName}`);
            failed++;
        }
    }

    try {
        console.log('1. Connecting to test MongoDB database & starting test HTTP server...');
        await mongoose.connect(process.env.MONGO_URI);

        const app = express();
        app.use(express.json());
        app.use('/api/orders', orderRoutes);
        app.use('/api/admin', adminRoutes);

        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}/api`;
        console.log(`Connected to MongoDB and HTTP server listening on ${baseUrl}\n`);

        // Clean up test collections
        await User.deleteMany({ email: /@test\.local$/ });
        await Product.deleteMany({ name: /^TEST_/ });
        await Order.deleteMany({});

        // 2. Setup mock buyer, vendor, admin, and product
        console.log('2. Setting up test users and product...');
        mockBuyer = await User.create({
            name: 'Test Buyer',
            email: 'buyer@test.local',
            phone: '9876543210',
            password: 'password123',
            role: 'buyer',
            isActive: true
        });
        buyerToken = signToken(mockBuyer);

        mockVendor = await User.create({
            name: 'Test Artisan',
            email: 'vendor@test.local',
            phone: '9876543211',
            password: 'password123',
            role: 'vendor',
            businessName: 'Artisan Workshop',
            location: 'Jaipur',
            isActive: true
        });
        vendorToken = signToken(mockVendor);

        mockAdmin = await User.create({
            name: 'Test Admin',
            email: 'admin@test.local',
            phone: '9876543212',
            password: 'password123',
            role: 'admin',
            isActive: true
        });
        adminToken = signToken(mockAdmin);

        mockProduct = await Product.create({
            vendor: mockVendor._id,
            name: 'TEST_Blue Pottery Vase',
            description: 'Handcrafted ceramic vase',
            category: 'Pottery & Clay Art',
            price: 750,
            stock: 10
        });

        console.log('Test fixtures created.\n');

        // 3. Test Signature Verification & Config Validation
        console.log('3. Testing HMAC SHA-256 Signature Verification...');
        const testOrderId = 'order_test_987654';
        const testPaymentId = 'pay_test_123456';
        const validSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${testOrderId}|${testPaymentId}`)
            .digest('hex');

        assert(
            razorpayService.verifySignature(testOrderId, testPaymentId, validSignature) === true,
            'Valid Razorpay HMAC signature is verified successfully'
        );
        assert(
            razorpayService.verifySignature(testOrderId, testPaymentId, 'invalid_signature_hex') === false,
            'Tampered or forged signature is rejected'
        );
        assert(
            razorpayService.verifySignature(testOrderId, 'pay_different', validSignature) === false,
            'Mismatched payment ID with valid signature is rejected'
        );
        assert(
            razorpayService.verifySignature(null, testPaymentId, validSignature) === false,
            'Null orderId is safely rejected without crash'
        );

        // 4. Test Unconfigured & Placeholder Key Guard
        console.log('\n4. Testing Unconfigured & Placeholder Key Fallback...');
        const originalKey = process.env.RAZORPAY_KEY_ID;
        delete process.env.RAZORPAY_KEY_ID;
        assert(razorpayService.isConfigured() === false, 'isConfigured returns false when key is absent');

        const unconfRes = await apiCall('/orders', 'POST', buyerToken, {
            items: [{ product: mockProduct._id, quantity: 1 }],
            shippingAddress: { name: 'Buyer', phone: '9876543210', address: '123 Street' },
            paymentMethod: 'Razorpay'
        });
        assert(unconfRes.status === 503, 'Online payment order creation returns 503 when Razorpay is not configured');

        process.env.RAZORPAY_KEY_ID = 'rzp_test_your_key_id';
        assert(razorpayService.isConfigured() === false, 'isConfigured rejects placeholder key value');

        process.env.RAZORPAY_KEY_ID = originalKey;
        assert(razorpayService.isConfigured() === true, 'isConfigured returns true when real keys are present');

        // 5. Test Authentication & Input Validation
        console.log('\n5. Testing Route Authentication and Validation...');
        const unauthRes = await apiCall('/orders/razorpay/verify', 'POST', null, {
            razorpay_order_id: 'order_123',
            razorpay_payment_id: 'pay_123',
            razorpay_signature: 'sig_123'
        });
        assert(unauthRes.status === 401, 'Unauthenticated payment verify is rejected with 401');

        const vendorTryBuy = await apiCall('/orders', 'POST', vendorToken, {
            items: [{ product: mockProduct._id, quantity: 1 }],
            shippingAddress: { name: 'V', phone: '9876543210', address: '123' },
            paymentMethod: 'Razorpay'
        });
        assert(vendorTryBuy.status === 403, 'Vendor role is blocked from placing buyer orders with 403');

        const overStockRes = await apiCall('/orders', 'POST', buyerToken, {
            items: [{ product: mockProduct._id, quantity: 15 }],
            shippingAddress: { name: 'Buyer', phone: '9876543210', address: '123 Street' },
            paymentMethod: 'Razorpay'
        });
        assert(overStockRes.status === 409, 'Insufficient stock fails fast with 409 before creating Razorpay order');

        // 6. Test Cash on Delivery Order Creation (Backward Compatibility)
        console.log('\n6. Testing Cash on Delivery order creation (Compatibility)...');
        const initialStock = (await Product.findById(mockProduct._id)).stock;
        const codRes = await apiCall('/orders', 'POST', buyerToken, {
            items: [{ product: mockProduct._id, quantity: 2 }],
            shippingAddress: { name: 'Buyer', phone: '9876543210', address: '123 Street' },
            paymentMethod: 'Cash on Delivery'
        });
        assert(codRes.status === 201, 'COD order created with 201 Created via HTTP');
        assert(codRes.data.orders[0].orderStatus === 'Placed', 'COD order status is Placed');
        assert(codRes.data.orders[0].paymentMethod === 'Cash on Delivery', 'COD paymentMethod recorded');
        assert(codRes.data.orders[0].paymentStatus === 'Pending', 'COD paymentStatus is Pending');

        const postCodStock = (await Product.findById(mockProduct._id)).stock;
        assert(postCodStock === initialStock - 2, 'Stock decremented by 2 for COD order');

        // 7. Test Razorpay Order Creation via HTTP
        console.log('\n7. Testing Razorpay Order Creation and Inventory Reservation...');
        const mockRzpOrderId = 'order_MOCK_' + Date.now();
        const origCreateOrder = razorpayService.createOrder;
        razorpayService.createOrder = async (amount, buyerId) => ({
            id: mockRzpOrderId,
            amount,
            currency: 'INR',
            status: 'created'
        });

        const rzpRes = await apiCall('/orders', 'POST', buyerToken, {
            items: [{ product: mockProduct._id, quantity: 1 }],
            shippingAddress: { name: 'Buyer', phone: '9876543210', address: '123 Street' },
            paymentMethod: 'Razorpay'
        });
        assert(rzpRes.status === 201, 'Razorpay order created with 201 Created via HTTP');
        assert(rzpRes.data.razorpay !== undefined, 'Response contains razorpay checkout payload');
        assert(rzpRes.data.razorpay.keyId === process.env.RAZORPAY_KEY_ID, 'Response exposes public keyId only');
        assert(!JSON.stringify(rzpRes.data).includes(process.env.RAZORPAY_KEY_SECRET), 'Secret key is NEVER exposed in response');
        assert(rzpRes.data.razorpay.orderId === mockRzpOrderId, 'Response contains generated razorpay orderId');
        assert(rzpRes.data.razorpay.amount === 75000, 'Response amount is in paise (₹750.00 = 75000)');
        assert(rzpRes.data.orders[0].orderStatus === 'Awaiting Payment', 'Order status is Awaiting Payment');
        assert(rzpRes.data.orders[0].razorpayOrderId === mockRzpOrderId, 'Order records razorpayOrderId');

        const postRzpStock = (await Product.findById(mockProduct._id)).stock;
        assert(postRzpStock === postCodStock - 1, 'Stock reserved (decremented) while awaiting payment');

        // 8. Test Invalid Signature Rejected via HTTP
        console.log('\n8. Testing Invalid Signature & Tampering Protection...');
        const badSigRes = await apiCall('/orders/razorpay/verify', 'POST', buyerToken, {
            razorpay_order_id: mockRzpOrderId,
            razorpay_payment_id: 'pay_tampered',
            razorpay_signature: 'deadbeef'.repeat(8)
        });
        assert(badSigRes.status === 400, 'Invalid Razorpay signature rejected with 400 Bad Request');

        // 9. Test Razorpay Payment Verification & Capture via HTTP
        console.log('\n9. Testing Razorpay Payment Verification and Capture Confirmation...');
        const mockRzpPaymentId = 'pay_MOCK_' + Date.now();
        const validRzpSig = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${mockRzpOrderId}|${mockRzpPaymentId}`)
            .digest('hex');

        const origFetch = razorpayService.fetchPayment;
        const origCapture = razorpayService.capturePayment;
        razorpayService.fetchPayment = async (pid) => ({
            id: pid,
            order_id: mockRzpOrderId,
            amount: 75000,
            currency: 'INR',
            status: 'authorized'
        });
        razorpayService.capturePayment = async (pid, amount) => ({
            id: pid,
            order_id: mockRzpOrderId,
            amount,
            currency: 'INR',
            status: 'captured'
        });

        const verifyRes = await apiCall('/orders/razorpay/verify', 'POST', buyerToken, {
            razorpay_order_id: mockRzpOrderId,
            razorpay_payment_id: mockRzpPaymentId,
            razorpay_signature: validRzpSig
        });
        assert(verifyRes.status === 200, 'Payment verification returns 200 OK via HTTP');
        assert(verifyRes.data.message === 'Payment verified', 'Response message is Payment verified');

        const paidOrder = await Order.findOne({ razorpayOrderId: mockRzpOrderId });
        assert(paidOrder.orderStatus === 'Placed', 'Order status transitioned to Placed');
        assert(paidOrder.paymentStatus === 'Completed', 'Payment status transitioned to Completed');
        assert(paidOrder.razorpayPaymentId === mockRzpPaymentId, 'Razorpay payment ID recorded in database');
        assert(paidOrder.razorpaySignature === validRzpSig, 'Razorpay signature recorded in database');
        assert(paidOrder.paidAt instanceof Date, 'paidAt timestamp recorded in database');

        // 10. Test Idempotent Payment Verification
        console.log('\n10. Testing Verification Idempotency...');
        const dupVerifyRes = await apiCall('/orders/razorpay/verify', 'POST', buyerToken, {
            razorpay_order_id: mockRzpOrderId,
            razorpay_payment_id: mockRzpPaymentId,
            razorpay_signature: validRzpSig
        });
        assert(dupVerifyRes.status === 200, 'Duplicate verification succeeds idempotently');
        assert(dupVerifyRes.data.orders[0].paymentStatus === 'Completed', 'Order remains Completed');

        // 11. Test Online Cancellation Protection for Paid Orders
        console.log('\n11. Testing Paid Order Cancellation Protection...');
        const cancelPaidRes = await apiCall(`/orders/${paidOrder._id}/cancel`, 'PUT', buyerToken);
        assert(cancelPaidRes.status === 400, 'Buyer cannot cancel completed Razorpay order online');
        assert(cancelPaidRes.data.message.includes('Contact support for a refund'), 'Explains contact support for refund');

        // 12. Test Abandoned/Dismissed Payment Cancellation & Stock Rollback via HTTP
        console.log('\n12. Testing Checkout Cancellation and Inventory Restoration...');
        const mockAbandonOrderId = 'order_ABANDON_' + Date.now();
        razorpayService.createOrder = async (amount, buyerId) => ({
            id: mockAbandonOrderId,
            amount,
            currency: 'INR',
            status: 'created'
        });

        const stockBeforeAbandon = (await Product.findById(mockProduct._id)).stock;
        const abandonOrderRes = await apiCall('/orders', 'POST', buyerToken, {
            items: [{ product: mockProduct._id, quantity: 2 }],
            shippingAddress: { name: 'Buyer', phone: '9876543210', address: '123 Street' },
            paymentMethod: 'Razorpay'
        });
        assert(abandonOrderRes.status === 201, 'Order created awaiting payment');
        const stockDuringAbandon = (await Product.findById(mockProduct._id)).stock;
        assert(stockDuringAbandon === stockBeforeAbandon - 2, 'Stock held during checkout');

        const origFetchPayments = razorpayService.fetchOrderPayments;
        razorpayService.fetchOrderPayments = async () => ({ items: [] });

        const cancelAbandonRes = await apiCall('/orders/razorpay/cancel', 'POST', buyerToken, {
            razorpayOrderId: mockAbandonOrderId
        });
        assert(cancelAbandonRes.status === 200, 'Cancellation endpoint returns 200 OK');
        assert(cancelAbandonRes.data.paymentCompleted === false, 'Cancellation confirms payment was not completed');

        const cancelledOrder = await Order.findOne({ razorpayOrderId: mockAbandonOrderId });
        assert(cancelledOrder.orderStatus === 'Cancelled', 'Abandoned order status is Cancelled');
        assert(cancelledOrder.paymentStatus === 'Failed', 'Abandoned order paymentStatus is Failed');

        const stockAfterCancel = (await Product.findById(mockProduct._id)).stock;
        assert(stockAfterCancel === stockBeforeAbandon, 'Stock was fully and atomically restored to inventory');

        // 13. Test Vendor & Admin Order Visibility
        console.log('\n13. Testing Vendor & Admin Orders Visibility...');
        // Create one extra Awaiting Payment order to verify filtering
        const mockPendingId = 'order_PENDING_' + Date.now();
        razorpayService.createOrder = async (amount) => ({ id: mockPendingId, amount, currency: 'INR', status: 'created' });
        await apiCall('/orders', 'POST', buyerToken, {
            items: [{ product: mockProduct._id, quantity: 1 }],
            shippingAddress: { name: 'Buyer', phone: '9876543210', address: '123 Street' },
            paymentMethod: 'Razorpay'
        });

        const vendorOrdersRes = await apiCall('/orders/vendor', 'GET', vendorToken);
        assert(vendorOrdersRes.status === 200, 'Vendor orders fetched successfully');
        assert(
            vendorOrdersRes.data.some(o => o.orderStatus === 'Awaiting Payment') === false,
            'Vendor cannot see unconfirmed Awaiting Payment orders'
        );
        assert(
            vendorOrdersRes.data.some(o => o.razorpayOrderId === mockRzpOrderId && o.orderStatus === 'Placed') === true,
            'Vendor can see verified Placed Razorpay orders'
        );

        const adminOrdersRes = await apiCall('/admin/orders', 'GET', adminToken);
        assert(adminOrdersRes.status === 200, 'Admin orders fetched successfully');
        assert(
            adminOrdersRes.data.orders.some(o => o.orderStatus === 'Awaiting Payment') === false,
            'Admin master orders view filters out Awaiting Payment orders by default'
        );

        const adminDashRes = await apiCall('/admin/dashboard', 'GET', adminToken);
        assert(adminDashRes.status === 200, 'Admin dashboard fetched successfully');
        assert(
            adminDashRes.data.orders.total === 3,
            'Admin dashboard total excludes Awaiting Payment orders (1 COD + 1 Paid + 1 Cancelled = 3)'
        );

        // 14. Test Razorpay SDK Error Handling (undefined error.message safeguard)
        console.log('\n14. Testing Razorpay SDK Error Format Handling...');
        razorpayService.createOrder = async () => {
            const sdkErr = { statusCode: 401, error: { code: 'BAD_REQUEST_ERROR', description: 'Authentication failed' } };
            throw sdkErr;
        };
        const sdkFailRes = await apiCall('/orders', 'POST', buyerToken, {
            items: [{ product: mockProduct._id, quantity: 1 }],
            shippingAddress: { name: 'Buyer', phone: '9876543210', address: '123 Street' },
            paymentMethod: 'Razorpay'
        });
        assert(sdkFailRes.status === 401, 'SDK error status propagates safely');
        assert(typeof sdkFailRes.data.message === 'string' && sdkFailRes.data.message.length > 0, 'SDK error returns safe non-empty message string');

        // Clean up mocks & DB
        razorpayService.createOrder = origCreateOrder;
        razorpayService.fetchPayment = origFetch;
        razorpayService.capturePayment = origCapture;
        razorpayService.fetchOrderPayments = origFetchPayments;

        // 15. Test Local Razorpay Demo Mode Fallback & Real Key Precedence
        console.log('\n15. Testing Local Razorpay Demo Mode & Live Key Priority...');
        process.env.RAZORPAY_DEMO_MODE = 'true';
        assert(razorpayService.isRealConfigured() === true, 'isRealConfigured stays true when real keys are set');
        assert(razorpayService.isDemoMode() === false, 'Real keys take strict priority over RAZORPAY_DEMO_MODE');

        const blockedDemoAuthRes = await apiCall('/orders/razorpay/demo-authorize', 'POST', buyerToken, {
            razorpayOrderId: 'order_any'
        });
        assert(blockedDemoAuthRes.status === 403, 'Demo authorize endpoint is blocked (403) when real keys are active');

        const savedRealKeyId = process.env.RAZORPAY_KEY_ID;
        const savedRealKeySecret = process.env.RAZORPAY_KEY_SECRET;
        process.env.RAZORPAY_KEY_ID = '';
        process.env.RAZORPAY_KEY_SECRET = '';

        assert(razorpayService.isRealConfigured() === false, 'isRealConfigured false when keys are empty');
        assert(razorpayService.isDemoMode() === true, 'isDemoMode activates when keys empty and RAZORPAY_DEMO_MODE=true');
        assert(razorpayService.isConfigured() === true, 'isConfigured true in Demo Mode');

        const demoOrderRes = await apiCall('/orders', 'POST', buyerToken, {
            items: [{ product: mockProduct._id, quantity: 1 }],
            shippingAddress: { name: 'Buyer', phone: '9876543210', address: '123 Street' },
            paymentMethod: 'Razorpay'
        });
        assert(demoOrderRes.status === 201, 'Demo Mode creates Razorpay order with 201 Created');
        assert(demoOrderRes.data.razorpay.demoMode === true, 'Demo Mode sets demoMode: true flag for UI');
        assert(demoOrderRes.data.razorpay.orderId.startsWith('order_demo_'), 'Demo Mode generates order_demo_* ID');

        const demoOrderId = demoOrderRes.data.razorpay.orderId;

        const wrongBuyerDemoRes = await apiCall('/orders/razorpay/demo-authorize', 'POST', vendorToken, {
            razorpayOrderId: demoOrderId
        });
        assert(wrongBuyerDemoRes.status === 403, 'Non-buyer blocked from demo-authorize (403)');

        const badDemoSigRes = await apiCall('/orders/razorpay/verify', 'POST', buyerToken, {
            razorpay_order_id: demoOrderId,
            razorpay_payment_id: 'pay_demo_fake',
            razorpay_signature: 'deadbeef'.repeat(8)
        });
        assert(badDemoSigRes.status === 400, 'Tampered signature still rejected (400) in Demo Mode');

        const demoAuthRes = await apiCall('/orders/razorpay/demo-authorize', 'POST', buyerToken, {
            razorpayOrderId: demoOrderId,
            method: 'upi'
        });
        assert(demoAuthRes.status === 200, 'Demo authorize succeeds (200) for owning buyer');
        assert(demoAuthRes.data.razorpay_order_id === demoOrderId, 'Demo authorize echoes razorpay_order_id');
        assert(demoAuthRes.data.razorpay_payment_id.startsWith('pay_demo_'), 'Demo authorize returns pay_demo_* ID');
        assert(typeof demoAuthRes.data.razorpay_signature === 'string' && demoAuthRes.data.razorpay_signature.length === 64, 'Demo authorize returns valid HMAC-SHA256 signature');

        const demoVerifyRes = await apiCall('/orders/razorpay/verify', 'POST', buyerToken, demoAuthRes.data);
        assert(demoVerifyRes.status === 200, 'Demo payment passes full server verification (200)');

        const demoPaidOrder = await Order.findOne({ razorpayOrderId: demoOrderId });
        assert(demoPaidOrder.orderStatus === 'Placed' && demoPaidOrder.paymentStatus === 'Completed', 'Demo order persisted as Placed + Completed');
        assert(demoPaidOrder.razorpayPaymentId === demoAuthRes.data.razorpay_payment_id, 'Demo payment ID persisted in MongoDB');

        // Test Demo Mode Cancellation & Stock Restoration
        const stockBeforeDemoCancel = (await Product.findById(mockProduct._id)).stock;
        const demoAbandonRes = await apiCall('/orders', 'POST', buyerToken, {
            items: [{ product: mockProduct._id, quantity: 2 }],
            shippingAddress: { name: 'Buyer', phone: '9876543210', address: '123 Street' },
            paymentMethod: 'Razorpay'
        });
        assert(demoAbandonRes.status === 201, 'Second demo order created for cancel test');
        const demoCancelRes = await apiCall('/orders/razorpay/cancel', 'POST', buyerToken, {
            razorpayOrderId: demoAbandonRes.data.razorpay.orderId
        });
        assert(demoCancelRes.status === 200 && demoCancelRes.data.paymentCompleted === false, 'Demo cancel transitions unpaid order cleanly');
        const stockAfterDemoCancel = (await Product.findById(mockProduct._id)).stock;
        assert(stockAfterDemoCancel === stockBeforeDemoCancel, 'Demo cancel restores product stock cleanly');

        process.env.RAZORPAY_KEY_ID = savedRealKeyId;
        process.env.RAZORPAY_KEY_SECRET = savedRealKeySecret;
        process.env.RAZORPAY_DEMO_MODE = 'false';

        await User.deleteMany({ email: /@test\.local$/ });
        await Product.deleteMany({ name: /^TEST_/ });
        await Order.deleteMany({});
        server.close();
        await mongoose.disconnect();

        console.log(`\n===========================================`);
        console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
        console.log(`===========================================\n`);

        process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
        console.error('Test error:', err);
        if (server) server.close();
        await mongoose.disconnect().catch(() => {});
        process.exit(1);
    }
}

runTests();
