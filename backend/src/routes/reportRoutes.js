const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const { createReport } = require('../controllers/reportController');

// Rate limit: 5 reports per 15 minutes per user
const reportRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { message: 'Too many reports submitted. Please wait before submitting another report.' },
    keyGenerator: (req) => (req.user ? req.user._id.toString() : req.ip),
    validate: { keyGeneratorIpFallback: false }
});

router.post('/', protect, reportRateLimiter, createReport);

module.exports = router;
