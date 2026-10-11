const Review = require('../models/Review');
const Product = require('../models/Product');

// @desc    Add a review for a product (Buyer)
// @route   POST /api/reviews
// @access  Private (Buyer)
exports.createReview = async (req, res) => {
    try {
        const { product, rating, comment } = req.body;

        if (!product || !rating || !comment) {
            return res.status(400).json({ message: 'Product, rating (1-5), and comment are required' });
        }

        const prod = await Product.findById(product);
        if (!prod) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const review = new Review({
            product,
            buyer: req.user._id,
            rating: Number(rating),
            comment
        });

        const savedReview = await review.save();
        res.status(201).json(savedReview);
    } catch (error) {
        console.error('Error creating review:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get reviews for a product
// @route   GET /api/reviews/product/:productId
// @access  Public
exports.getProductReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ product: req.params.productId })
            .populate('buyer', 'name')
            .sort({ createdAt: -1 });
        res.json(reviews);
    } catch (error) {
        console.error('Error getting product reviews:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
