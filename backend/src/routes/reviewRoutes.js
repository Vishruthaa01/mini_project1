const express = require('express');
const router = express.Router();
const { createReview, getProductReviews } = require('../controllers/reviewController');
const { protect, buyerOnly } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, buyerOnly, createReview);

router.route('/product/:productId')
    .get(getProductReviews);

module.exports = router;
