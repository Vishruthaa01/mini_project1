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
        const { category, search } = req.query;
        const query = {};

        if (category) {
            query.category = category;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const products = await Product.find(query).populate('vendor', 'name businessName location').sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        console.error('Error fetching all products:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('vendor', 'name businessName location about email phone');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        console.error('Error fetching product by ID:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Vendor
exports.updateProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.vendor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this product' });
        }

        const { name, category, description, image, rawMaterialsCost, laborHours, price, stock, sku } = req.body;

        if (name !== undefined) product.name = name;
        if (category !== undefined) product.category = category;
        if (description !== undefined) product.description = description;
        if (image !== undefined) product.image = image;
        if (rawMaterialsCost !== undefined) product.rawMaterialsCost = rawMaterialsCost;
        if (laborHours !== undefined) product.laborHours = laborHours;
        if (price !== undefined) product.price = price;
        if (stock !== undefined) product.stock = stock;
        if (sku !== undefined) product.sku = sku;

        const updatedProduct = await product.save();
        res.json(updatedProduct);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
