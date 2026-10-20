const express = require('express');
const router = express.Router();
const { 
    createProduct, 
    getVendorProducts, 
    deleteProduct, 
    getProducts, 
    getProductById, 
    updateProduct,
    getCategories,
    exportVendorListings
} = require('../controllers/productController');
const { protect, vendorOnly } = require('../middleware/authMiddleware');

router.route('/')
    .get(getProducts)
    .post(protect, vendorOnly, createProduct);

router.route('/categories')
    .get(getCategories);

router.route('/vendor')
    .get(protect, vendorOnly, getVendorProducts);

router.route('/vendor/export')
    .get(protect, vendorOnly, exportVendorListings);

router.route('/:id')
    .get(getProductById)
    .put(protect, vendorOnly, updateProduct)
    .delete(protect, vendorOnly, deleteProduct);

module.exports = router;
