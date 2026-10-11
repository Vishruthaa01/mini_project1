const express = require('express');
const router = express.Router();
const { 
    createInquiry, 
    getBuyerInquiries, 
    getVendorInquiries, 
    replyInquiry 
} = require('../controllers/inquiryController');
const { protect, vendorOnly } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createInquiry);

router.route('/buyer')
    .get(protect, getBuyerInquiries);

router.route('/vendor')
    .get(protect, vendorOnly, getVendorInquiries);

router.route('/:id/reply')
    .put(protect, vendorOnly, replyInquiry);

module.exports = router;
