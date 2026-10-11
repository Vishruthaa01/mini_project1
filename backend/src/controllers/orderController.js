const Order = require('../models/Order');
const Product = require('../models/Product');

// @desc    Create a new order (buyer)
// @route   POST /api/orders
// @access  Private (Buyer)
exports.createOrder = async (req, res) => {
    try {
        const { items, shippingAddress, paymentMethod, customizationNote } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'No order items specified' });
        }

        if (!shippingAddress || !shippingAddress.name || !shippingAddress.phone || !shippingAddress.address) {
            return res.status(400).json({ message: 'Shipping address (name, phone, address) is required' });
        }

        // Validate products and determine vendor
        let totalAmount = 0;
        let vendorId = null;
        const validatedItems = [];

        for (const item of items) {
            const product = await Product.findById(item.product);
            if (!product) {
                return res.status(404).json({ message: `Product not found: ${item.product}` });
            }

            if (!vendorId) {
                vendorId = product.vendor;
            }

            const qty = Number(item.quantity) || 1;
            totalAmount += product.price * qty;

            validatedItems.push({
                product: product._id,
                name: product.name,
                price: product.price,
                quantity: qty,
                image: product.image || ''
            });
        }

        const order = new Order({
            buyer: req.user._id,
            vendor: vendorId,
            items: validatedItems,
            totalAmount,
            shippingAddress,
            paymentMethod: paymentMethod || 'Cash on Delivery',
            paymentStatus: paymentMethod === 'UPI' || paymentMethod === 'Card' ? 'Completed' : 'Pending',
            orderStatus: 'Placed',
            customizationNote: customizationNote || ''
        });

        const savedOrder = await order.save();
        res.status(201).json(savedOrder);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Server error creating order' });
    }
};

// @desc    Get logged in buyer orders
// @route   GET /api/orders/my-orders
// @access  Private (Buyer)
exports.getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ buyer: req.user._id })
            .populate('vendor', 'name businessName phone location')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        console.error('Error fetching buyer orders:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get vendor orders
// @route   GET /api/orders/vendor
// @access  Private (Vendor)
exports.getVendorOrders = async (req, res) => {
    try {
        const orders = await Order.find({ vendor: req.user._id })
            .populate('buyer', 'name email phone')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        console.error('Error fetching vendor orders:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('buyer', 'name email phone')
            .populate('vendor', 'name businessName phone location');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Only buyer or vendor of this order can view it
        const isBuyer = order.buyer._id.toString() === req.user._id.toString();
        const isVendor = order.vendor._id.toString() === req.user._id.toString();

        if (!isBuyer && !isVendor && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to view this order' });
        }

        res.json(order);
    } catch (error) {
        console.error('Error fetching order by ID:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (Vendor)
exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderStatus, paymentStatus } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.vendor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to update this order' });
        }

        if (orderStatus) order.orderStatus = orderStatus;
        if (paymentStatus) order.paymentStatus = paymentStatus;

        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
