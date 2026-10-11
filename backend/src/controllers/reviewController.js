const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');

// @desc    Add a review for a product (Buyer only, only if delivered)
// @route   POST /api/reviews
// @access  Private (Buyer)
exports.createReview = async (req, res) => {
    try {
        const { product, rating, comment } = req.body;

        // 1. Validate product ID format
        if (!product || !mongoose.Types.ObjectId.isValid(product)) {
            return res.status(400).json({ message: 'Valid product ID is required' });
        }

        const productDoc = await Product.findById(product);
        if (!productDoc) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // 2. Rating must be integer 1 to 5
        const numRating = parseInt(rating, 10);
        if (isNaN(numRating) || numRating < 1 || numRating > 5) {
            return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
        }

        // 3. Comment must be 1 to 500 characters, trimmed
        const trimmedComment = (comment || '').trim();
        if (!trimmedComment) {
            return res.status(400).json({ message: 'Comment cannot be empty' });
        }
        if (trimmedComment.length > 500) {
            return res.status(400).json({ message: 'Comment must be at most 500 characters' });
        }

        // 4. Check if buyer already reviewed this product (return 409 friendly message)
        const existingReview = await Review.findOne({
            product: productDoc._id,
            buyer: req.user._id
        });
        if (existingReview) {
            return res.status(409).json({ message: 'You have already reviewed this product' });
        }

        // 5. Verify the buyer has a 'Delivered' order containing this product
        const deliveredOrder = await Order.findOne({
            buyer: req.user._id,
            orderStatus: 'Delivered',
            'items.product': productDoc._id
        });

        if (!deliveredOrder) {
            return res.status(400).json({
                message: 'You can only review products that have been delivered to you'
            });
        }

        const review = new Review({
            product: productDoc._id,
            buyer: req.user._id,
            rating: numRating,
            comment: trimmedComment
        });

        const savedReview = await review.save();
        return res.status(201).json(savedReview);
    } catch (error) {
        // Handle MongoDB duplicate key error (E11000)
        if (error.code === 11000) {
            return res.status(409).json({ message: 'You have already reviewed this product' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        console.error('Error creating review:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get reviews for a product with averageRating and count
// @route   GET /api/reviews/product/:productId
// @access  Public
exports.getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }

        const reviews = await Review.find({ product: productId })
            .populate('buyer', 'name')
            .sort({ createdAt: -1 });

        const count = reviews.length;
        let averageRating = 0;

        if (count > 0) {
            const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
            averageRating = Number((sum / count).toFixed(1));
        }

        return res.json({
            reviews,
            averageRating,
            count
        });
    } catch (error) {
        console.error('Error getting product reviews:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};
