const mongoose = require('mongoose');
const Product = require('../models/Product');

// Helper to escape regex special characters in search query
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// @desc    Get product category enum list from schema
// @route   GET /api/products/categories
// @access  Public
exports.getCategories = async (req, res) => {
    try {
        const categories = Product.schema.path('category').enumValues;
        return res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all products with filtering, search, sorting and pagination
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
    try {
        const { q, category, minPrice, maxPrice, inStock, sort, page, limit } = req.query;
        const query = {};

        // Search in title and description with escaped regex
        if (q && q.trim()) {
            const escaped = escapeRegex(q.trim());
            query.$or = [
                { name: { $regex: escaped, $options: 'i' } },
                { description: { $regex: escaped, $options: 'i' } }
            ];
        }

        // Validate category against schema enum
        if (category) {
            const allowedCategories = Product.schema.path('category').enumValues;
            if (!allowedCategories.includes(category)) {
                return res.status(400).json({ message: `Invalid category: ${category}` });
            }
            query.category = category;
        }

        // Price range filter
        if (minPrice !== undefined || maxPrice !== undefined) {
            query.price = {};
            if (minPrice !== undefined && !isNaN(Number(minPrice))) {
                query.price.$gte = Number(minPrice);
            }
            if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
                query.price.$lte = Number(maxPrice);
            }
            if (Object.keys(query.price).length === 0) {
                delete query.price;
            }
        }

        // In-stock only filter
        if (inStock === 'true' || inStock === true) {
            query.stock = { $gt: 0 };
        }

        // Sorting options
        let sortOption = { createdAt: -1 }; // newest by default
        if (sort === 'priceAsc') {
            sortOption = { price: 1 };
        } else if (sort === 'priceDesc') {
            sortOption = { price: -1 };
        }

        // Pagination
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const requestedLimit = parseInt(limit, 10) || 12;
        const currentLimit = Math.min(50, Math.max(1, requestedLimit));
        const skip = (currentPage - 1) * currentLimit;

        const total = await Product.countDocuments(query);
        const totalPages = Math.ceil(total / currentLimit) || 1;

        // Exclude rawMaterialsCost and laborHours; populate vendor with only businessName and location
        const products = await Product.find(query)
            .select('-rawMaterialsCost -laborHours')
            .populate('vendor', 'businessName location')
            .sort(sortOption)
            .skip(skip)
            .limit(currentLimit);

        return res.json({
            products,
            page: currentPage,
            totalPages,
            total
        });
    } catch (error) {
        console.error('Error fetching products:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get single product by ID (excluding sensitive fields)
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        // Check for valid MongoDB ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }

        // Exclude rawMaterialsCost and laborHours
        // Populate vendor ONLY with 'businessName location craftCategory about' (NEVER email or phone)
        const product = await Product.findById(id)
            .select('-rawMaterialsCost -laborHours')
            .populate('vendor', 'businessName location craftCategory about');

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        return res.json(product);
    } catch (error) {
        console.error('Error fetching product by ID:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get vendor's products (owner views all their own fields)
// @route   GET /api/products/vendor
// @access  Private/Vendor
exports.getVendorProducts = async (req, res) => {
    try {
        const products = await Product.find({ vendor: req.user._id }).sort({ createdAt: -1 });
        return res.json(products);
    } catch (error) {
        console.error('Error fetching vendor products:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Vendor
exports.createProduct = async (req, res) => {
    try {
        const { 
            name, 
            category, 
            description, 
            titleHi, 
            descriptionHi, 
            keywords, 
            image, 
            rawMaterialsCost, 
            laborHours, 
            price, 
            stock, 
            sku 
        } = req.body;

        const product = new Product({
            name,
            category,
            description,
            titleHi,
            descriptionHi,
            keywords: Array.isArray(keywords) ? keywords.slice(0, 10) : undefined,
            image,
            rawMaterialsCost,
            laborHours,
            price,
            stock,
            sku,
            vendor: req.user._id
        });

        const createdProduct = await product.save();
        return res.status(201).json(createdProduct);
    } catch (error) {
        // Return 400 with Mongoose validation message instead of 500
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        console.error('Error creating product:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Vendor
exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }

        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Verify the authenticated vendor is the owner of this product
        if (product.vendor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this product' });
        }

        const { 
            name, 
            category, 
            description, 
            titleHi, 
            descriptionHi, 
            keywords, 
            image, 
            rawMaterialsCost, 
            laborHours, 
            price, 
            stock, 
            sku 
        } = req.body;

        if (name !== undefined) product.name = name;
        if (category !== undefined) product.category = category;
        if (description !== undefined) product.description = description;
        if (titleHi !== undefined) product.titleHi = titleHi;
        if (descriptionHi !== undefined) product.descriptionHi = descriptionHi;
        if (keywords !== undefined && Array.isArray(keywords)) product.keywords = keywords.slice(0, 10);
        if (image !== undefined) product.image = image;
        if (rawMaterialsCost !== undefined) product.rawMaterialsCost = rawMaterialsCost;
        if (laborHours !== undefined) product.laborHours = laborHours;
        if (price !== undefined) product.price = price;
        if (stock !== undefined) product.stock = stock;
        if (sku !== undefined) product.sku = sku;

        const updatedProduct = await product.save();
        return res.json(updatedProduct);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        console.error('Error updating product:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Vendor
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }

        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.vendor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this product' });
        }

        await product.deleteOne();
        return res.json({ message: 'Product removed' });
    } catch (error) {
        console.error('Error deleting product:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};
