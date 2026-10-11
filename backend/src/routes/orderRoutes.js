const express = require('express');
const router = express.Router();
const { 
    createOrder, 
    getMyOrders, 
    getVendorOrders, 
    getOrderById, 
    updateOrderStatus 
} = require('../controllers/orderController');
const { protect, vendorOnly } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createOrder);

router.route('/my-orders')
    .get(protect, getMyOrders);

router.route('/vendor')
    .get(protect, vendorOnly, getVendorOrders);

router.route('/:id')
    .get(protect, getOrderById);

router.route('/:id/status')
    .put(protect, vendorOnly, updateOrderStatus);

module.exports = router;
