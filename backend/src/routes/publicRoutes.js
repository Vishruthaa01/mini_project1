const express = require('express');
const router = express.Router();
const { getVendorStorefront } = require('../controllers/publicController');

// Public vendor storefront endpoint (no authentication required)
router.get('/store/:vendorId', getVendorStorefront);

module.exports = router;
