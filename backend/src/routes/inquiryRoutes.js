const express = require('express');
const router = express.Router();
const { 
    createInquiry, 
    getBuyerInquiries, 
    getVendorInquiries, 
    replyInquiry 
} = require('../controllers/inquiryController');
const { protect, vendorOnly, buyerOnly } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, buyerOnly, createInquiry);

router.route('/buyer')
    .get(protect, buyerOnly, getBuyerInquiries);

router.route('/vendor')
    .get(protect, vendorOnly, getVendorInquiries);

router.route('/:id/reply')
    .put(protect, vendorOnly, replyInquiry);

module.exports = router;
