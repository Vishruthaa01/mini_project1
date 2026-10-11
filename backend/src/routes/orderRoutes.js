const express = require('express');
const router = express.Router();
const { 
    createOrder, 
    cancelOrder,
    getMyOrders, 
    getVendorOrders, 
    getOrderById, 
    updateOrderStatus 
} = require('../controllers/orderController');
const { protect, vendorOnly, buyerOnly } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, buyerOnly, createOrder);

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
