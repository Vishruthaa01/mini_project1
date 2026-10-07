const express = require('express');
const router = express.Router();
const { createProduct, getVendorProducts, deleteProduct, getProducts } = require('../controllers/productController');
const { protect, vendorOnly } = require('../middleware/authMiddleware');

router.route('/')
    .get(getProducts)
    .post(protect, vendorOnly, createProduct);

router.route('/vendor')
    .get(protect, vendorOnly, getVendorProducts);

router.route('/:id')
    .delete(protect, vendorOnly, deleteProduct);

module.exports = router;
