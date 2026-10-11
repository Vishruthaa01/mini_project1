const express = require('express');
const router = express.Router();
const { 
    createProduct, 
    getVendorProducts, 
    deleteProduct, 
    getProducts, 
    getProductById, 
    updateProduct 
} = require('../controllers/productController');
const { protect, vendorOnly } = require('../middleware/authMiddleware');

router.route('/')
    .get(getProducts)
    .post(protect, vendorOnly, createProduct);

router.route('/vendor')
    .get(protect, vendorOnly, getVendorProducts);

router.route('/:id')
    .get(getProductById)
    .put(protect, vendorOnly, updateProduct)
    .delete(protect, vendorOnly, deleteProduct);

module.exports = router;
