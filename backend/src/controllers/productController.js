const Product = require('../models/Product');

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Vendor
exports.createProduct = async (req, res) => {
    try {
        const { name, category, description, image, rawMaterialsCost, laborHours, price, stock, sku } = req.body;

        const product = new Product({
            name,
            category,
            description,
            image,
            rawMaterialsCost,
            laborHours,
            price,
            stock,
            sku,
            vendor: req.user._id
        });

        const createdProduct = await product.save();
        res.status(201).json(createdProduct);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get vendor's products
// @route   GET /api/products/vendor
// @access  Private/Vendor
exports.getVendorProducts = async (req, res) => {
    try {
        const products = await Product.find({ vendor: req.user._id }).sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Vendor
exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Make sure the user is the vendor of this product
        if (product.vendor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this product' });
        }

        await product.deleteOne();
        res.json({ message: 'Product removed' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get all products
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find({}).populate('vendor', 'name businessName').sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        console.error('Error fetching all products:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
