const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { protect, vendorOnly } = require('../middleware/authMiddleware');
const Product = require('../models/Product');
const { calculatePriceSuggestion } = require('../services/pricingService');
const { saveProductImage } = require('../services/storage');

// ── Rate Limiting ────────────────────────────────────────────────────────────
// Rate limiter for AI routes: 20 requests per 10 minutes per authenticated user
const aiRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 20, // limit each vendor to 20 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    keyGenerator: (req) => {
        return req.user ? req.user._id.toString() : req.ip;
    },
    message: { message: 'Too many AI requests from this account, please try again in a few minutes.' }
});

// ── Multer Configuration for Image Uploads ───────────────────────────────────
const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 8 * 1024 * 1024 // 8 MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
            'image/pjpeg', 'image/x-png', 'image/jfif'
        ];
        if (allowedMimes.includes(file.mimetype.toLowerCase()) || file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
        }
    }
});

// Middleware to handle multer upload errors cleanly
function handleImageUpload(req, res, next) {
    imageUpload.single('image')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'Image size exceeds maximum limit of 8 MB' });
            }
            return res.status(400).json({ message: err.message });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    });
}

/**
 * Inspects buffer header magic bytes to verify the file is truly an image
 * and not a renamed malicious binary or text file.
 */
function verifyImageMagicBytes(buffer) {
    if (!buffer || buffer.length < 12) return null;

    // JPEG: SOI marker FF D8
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        return '.jpg';
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        return '.png';
    }
    // WebP: 'RIFF' .... 'WEBP'
    if (buffer.toString('utf8', 0, 4) === 'RIFF' && buffer.toString('utf8', 8, 12) === 'WEBP') {
        return '.webp';
    }

    return null;
}

// ── AI Route 1: Price Suggestion ─────────────────────────────────────────────
// @desc    Calculate AI price suggestion (Stage A cost-plus + Stage B market percentiles)
// @route   POST /api/ai/price-suggestion
// @access  Private/Vendor
router.post('/price-suggestion', protect, vendorOnly, aiRateLimiter, async (req, res) => {
    try {
        const { category, rawMaterialsCost, laborHours, description } = req.body;

        // Validation: Category is required and must match Product schema enum
        const allowedCategories = Product.schema.path('category').enumValues;
        if (!category || !allowedCategories.includes(category)) {
            return res.status(400).json({ 
                message: `Invalid or missing category. Allowed categories: ${allowedCategories.join(', ')}` 
            });
        }

        const materialsNum = Number(rawMaterialsCost);
        const hoursNum = Number(laborHours);

        if (isNaN(materialsNum) || materialsNum < 0) {
            return res.status(400).json({ message: 'Raw materials cost must be a positive number or zero' });
        }

        if (isNaN(hoursNum) || hoursNum < 0) {
            return res.status(400).json({ message: 'Labor hours must be a positive number or zero' });
        }

        if (materialsNum === 0 && hoursNum === 0) {
            return res.status(400).json({ message: 'Please provide either raw material cost or labor hours greater than zero' });
        }

        // Calculate pricing suggestions
        const result = await calculatePriceSuggestion({
            category,
            rawMaterialsCost: materialsNum,
            laborHours: hoursNum,
            description,
            currentVendorId: req.user._id
        });

        return res.json(result);
    } catch (error) {
        console.error('Price suggestion error:', error.message);
        return res.status(500).json({ message: 'Failed to calculate price suggestion' });
    }
});

// ── AI Route 2: Image Studio Enhancement ─────────────────────────────────────
// @desc    Enhance product image (removes background, fixes lighting, square white canvas)
// @route   POST /api/ai/enhance-image
// @access  Private/Vendor
router.post('/enhance-image', protect, vendorOnly, aiRateLimiter, handleImageUpload, async (req, res) => {
    if (!req.file || !req.file.buffer) {
        return res.status(400).json({ message: 'No image file uploaded' });
    }

    // Verify true file signature (magic bytes)
    const detectedExt = verifyImageMagicBytes(req.file.buffer);
    if (!detectedExt) {
        return res.status(400).json({ message: 'Corrupt or unsupported image format. Only JPEG, PNG, and WebP are allowed.' });
    }

    const aiServiceUrl = (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
    const aiServiceKey = process.env.AI_SERVICE_KEY || 'your_shared_service_secret_key_here';

    try {
        // Forward image buffer to Python AI Service using Node's built-in FormData and fetch
        const formData = new FormData();
        const mimeMap = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
        const safeMime = mimeMap[detectedExt] || req.file.mimetype || 'image/jpeg';
        const imageBlob = new Blob([req.file.buffer], { type: safeMime });
        formData.append('image', imageBlob, `upload${detectedExt}`);

        const aiResponse = await fetch(`${aiServiceUrl}/enhance-image`, {
            method: 'POST',
            headers: {
                'X-Service-Key': aiServiceKey
            },
            body: formData,
            signal: AbortSignal.timeout(15000) // 15 second timeout
        });

        if (aiResponse.ok) {
            const arrayBuffer = await aiResponse.arrayBuffer();
            const enhancedBuffer = Buffer.from(arrayBuffer);

            // Save enhanced WebP file to disk
            const saved = await saveProductImage(enhancedBuffer, '.webp');

            return res.json({
                imageUrl: saved.absoluteUrl,
                enhanced: true
            });
        } else {
            const errText = await aiResponse.text();
            console.warn('AI Service returned error for image enhancement:', errText);
            throw new Error(`AI service responded with status ${aiResponse.status}`);
        }
    } catch (error) {
        // GRACEFUL DEGRADATION:
        // If Python AI service is down or unreachable, save the raw original image
        // so the artisan is never blocked from publishing their catalog!
        console.warn('Image enhancement fallback triggered:', error.message);

        try {
            const savedOriginal = await saveProductImage(req.file.buffer, detectedExt);
            return res.json({
                imageUrl: savedOriginal.absoluteUrl,
                enhanced: false,
                message: 'AI service unavailable; saved original photo without background removal.'
            });
        } catch (saveError) {
            console.error('Failed to save fallback image:', saveError.message);
            return res.status(500).json({ message: 'Failed to save product image' });
        }
    }
});

// ── AI Route 3: Multilingual Auto-Cataloger ──────────────────────────────────
// Multer configuration for audio and text input
const catalogUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB max for audio
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'audio') {
            const allowedAudioMimes = [
                'audio/webm', 'audio/ogg', 'audio/wav', 'audio/wave', 
                'audio/x-wav', 'audio/mp3', 'audio/mpeg', 'audio/m4a', 
                'audio/mp4', 'audio/x-m4a'
            ];
            if (allowedAudioMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
                cb(null, true);
            } else {
                cb(new Error('Invalid audio file format. Supported formats: WebM, OGG, WAV, MP3, M4A'));
            }
        } else if (file.fieldname === 'image') {
            const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
            if (allowedImageMimes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Invalid image file format'));
            }
        } else {
            cb(null, true);
        }
    }
});

function handleCatalogUpload(req, res, next) {
    catalogUpload.fields([
        { name: 'audio', maxCount: 1 },
        { name: 'image', maxCount: 1 }
    ])(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'Upload exceeds maximum file limit of 5 MB' });
            }
            return res.status(400).json({ message: err.message });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    });
}

// @desc    Generate multilingual catalog listing from voice note or rough text
// @route   POST /api/ai/catalog
// @access  Private/Vendor
router.post('/catalog', protect, vendorOnly, aiRateLimiter, handleCatalogUpload, async (req, res) => {
    const text = (req.body.text || '').trim();
    const language = (req.body.language || '').trim();
    const audioFile = req.files && req.files.audio && req.files.audio[0];

    if (!text && !audioFile) {
        return res.status(400).json({ message: 'Please provide either a voice recording or a text description.' });
    }

    const aiServiceUrl = (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
    const aiServiceKey = process.env.AI_SERVICE_KEY || 'your_shared_service_secret_key_here';

    try {
        const formData = new FormData();
        if (text) {
            formData.append('text', text);
        }
        if (language) {
            formData.append('language', language);
        }
        if (audioFile) {
            const audioBlob = new Blob([audioFile.buffer], { type: audioFile.mimetype });
            formData.append('audio', audioBlob, audioFile.originalname || 'voice.webm');
        }

        const aiResponse = await fetch(`${aiServiceUrl}/catalog`, {
            method: 'POST',
            headers: {
                'X-Service-Key': aiServiceKey
            },
            body: formData,
            signal: AbortSignal.timeout(30000) // 30s timeout
        });

        if (aiResponse.ok) {
            const catalogData = await aiResponse.json();
            return res.json({
                ...catalogData,
                enhanced: true
            });
        } else {
            const errText = await aiResponse.text();
            console.warn('AI Service catalog generation warning:', errText);
            throw new Error(`AI catalog service returned status ${aiResponse.status}`);
        }
    } catch (error) {
        // GRACEFUL DEGRADATION:
        // Never block the artisan. Provide clean baseline listing from user text.
        console.warn('Cataloger fallback triggered:', error.message);

        const fallbackTitle = text ? text.split('\n')[0].slice(0, 80) : 'Artisan Handcrafted Product';
        const fallbackDesc = text || 'Handcrafted authentic artisan product.';

        return res.json({
            transcript: '',
            detectedLanguage: language || 'en',
            titleEn: fallbackTitle,
            descriptionEn: fallbackDesc,
            titleHi: '',
            descriptionHi: '',
            category: 'Other',
            keywords: [],
            enhanced: false,
            message: 'AI catalog assistant is temporarily unavailable. Your input has been placed into the form.'
        });
    }
});

module.exports = router;

