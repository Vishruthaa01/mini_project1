const express = require('express');
const router = express.Router();
const { 
    createOrder, 
    demoAuthorizeRazorpayPayment,
    verifyRazorpayPayment,
    cancelRazorpayPayment,
    cancelOrder,
    getMyOrders, 
    getVendorOrders, 
    getOrderById, 
    updateOrderStatus 
} = require('../controllers/orderController');
const { protect, vendorOnly, buyerOnly } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, buyerOnly, createOrder);

router.route('/razorpay/demo-authorize')
    .post(protect, buyerOnly, demoAuthorizeRazorpayPayment);

router.route('/razorpay/verify')
    .post(protect, buyerOnly, verifyRazorpayPayment);

router.route('/razorpay/cancel')
    .post(protect, buyerOnly, cancelRazorpayPayment);

router.route('/my-orders')
    .get(protect, buyerOnly, getMyOrders);

router.route('/vendor')
    .get(protect, vendorOnly, getVendorOrders);

router.route('/:id/cancel')
    .put(protect, buyerOnly, cancelOrder);

router.route('/:id/status')
    .put(protect, vendorOnly, updateOrderStatus);

router.route('/:id')
    .get(protect, getOrderById);

module.exports = router;
