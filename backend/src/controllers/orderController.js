const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// Allowed status transition map for vendor order management
const ALLOWED_TRANSITIONS = {
    'Placed': ['Confirmed', 'Cancelled'],
    'Confirmed': ['Processing', 'Cancelled'],
    'Processing': ['Shipped', 'Cancelled'],
    'Shipped': ['Delivered'],
    'Delivered': [],
    'Cancelled': []
};

// @desc    Create a new order (buyer only)
// @route   POST /api/orders
// @access  Private (Buyer)
exports.createOrder = async (req, res) => {
    try {
        const { items, shippingAddress, paymentMethod, customizationNote } = req.body;

        // 1. Validate items array
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Items array must not be empty' });
        }
        if (items.length > 20) {
            return res.status(400).json({ message: 'Maximum 20 items per order allowed' });
        }

        // 2. Merge duplicate items by product ID and validate quantities
        const mergedMap = new Map();
        for (const item of items) {
            if (!item || !item.product || !mongoose.Types.ObjectId.isValid(item.product)) {
                return res.status(400).json({ message: 'Invalid product ID in items' });
            }
            const prodId = item.product.toString();
            const qty = parseInt(item.quantity, 10);
            if (isNaN(qty) || qty < 1) {
                return res.status(400).json({ message: 'Item quantity must be an integer of at least 1' });
            }

            const currentQty = mergedMap.get(prodId) || 0;
            const newQty = currentQty + qty;
            if (newQty > 20) {
                return res.status(400).json({ message: 'Maximum quantity of 20 per product exceeded' });
            }
            mergedMap.set(prodId, newQty);
        }

        // 3. Validate and sanitize shipping address
        if (!shippingAddress || typeof shippingAddress !== 'object') {
            return res.status(400).json({ message: 'Shipping address is required' });
        }
        const name = (shippingAddress.name || '').trim();
        const phone = (shippingAddress.phone || '').trim();
        const address = (shippingAddress.address || '').trim();
        const city = (shippingAddress.city || '').trim();
        const state = (shippingAddress.state || '').trim();
        const postalCode = (shippingAddress.postalCode || '').trim();

        if (!name || name.length > 100) {
            return res.status(400).json({ message: 'Recipient name is required (max 100 characters)' });
        }
        if (!phone || phone.length > 20) {
            return res.status(400).json({ message: 'Phone number is required (max 20 characters)' });
        }
        if (!address || address.length > 300) {
            return res.status(400).json({ message: 'Shipping address is required (max 300 characters)' });
        }
        if (city.length > 100 || state.length > 100 || postalCode.length > 20) {
            return res.status(400).json({ message: 'City, state, or postal code exceeded maximum length' });
        }
        const sanitizedAddress = { name, phone, address, city, state, postalCode };

        // 4. Payment method check (Only Cash on Delivery is currently supported)
        let resolvedPaymentMethod = 'Cash on Delivery';
        if (paymentMethod) {
            const normalized = paymentMethod.toString().trim().toLowerCase();
            if (normalized === 'cash on delivery' || normalized === 'cod') {
                resolvedPaymentMethod = 'Cash on Delivery';
            } else {
                return res.status(400).json({ message: 'Only Cash on Delivery is accepted for now' });
            }
        }

        // 5. Customization note check
        const trimmedNote = (customizationNote || '').trim();
        if (trimmedNote.length > 500) {
            return res.status(400).json({ message: 'Customization note must be at most 500 characters' });
        }

        // 6. Look up products from DB, take prices and images from DB, group by vendor
        const vendorGroups = new Map();
        const itemsToDecrement = [];

        for (const [prodId, qty] of mergedMap.entries()) {
            const productDoc = await Product.findById(prodId);
            if (!productDoc) {
                return res.status(404).json({ message: 'One or more items in your cart are no longer available. Please refresh your cart.' });
            }

            const vendorKey = productDoc.vendor.toString();
            if (!vendorGroups.has(vendorKey)) {
                vendorGroups.set(vendorKey, { vendorId: productDoc.vendor, items: [], totalAmount: 0 });
            }

            const group = vendorGroups.get(vendorKey);
            group.items.push({
                product: productDoc._id,
                name: productDoc.name,
                price: productDoc.price,
                quantity: qty,
                image: productDoc.image || ''
            });
            group.totalAmount += productDoc.price * qty;

            itemsToDecrement.push({
                productId: productDoc._id,
                qty,
                name: productDoc.name,
                currentStock: productDoc.stock
            });
        }

        // 7. Atomically decrease stock with rollback on insufficient stock
        const decrementedList = [];
        for (const item of itemsToDecrement) {
            const updated = await Product.findOneAndUpdate(
                { _id: item.productId, stock: { $gte: item.qty } },
                { $inc: { stock: -item.qty } },
                { new: true }
            );

            if (!updated) {
                // Insufficient stock: roll back previously decremented items
                for (const dec of decrementedList) {
                    await Product.findByIdAndUpdate(dec.productId, { $inc: { stock: dec.qty } });
                }
                return res.status(409).json({
                    message: `Not enough stock for ${item.name}. Requested: ${item.qty}, Available: ${item.currentStock}`
                });
            }

            decrementedList.push(item);
        }

        // 8. Create one order per vendor with stock rollback protection
        const createdOrders = [];
        try {
            for (const group of vendorGroups.values()) {
                const order = new Order({
                    buyer: req.user._id,
                    vendor: group.vendorId,
                    items: group.items,
                    totalAmount: group.totalAmount,
                    shippingAddress: sanitizedAddress,
                    paymentMethod: resolvedPaymentMethod,
                    paymentStatus: 'Pending',
                    orderStatus: 'Placed',
                    customizationNote: trimmedNote
                });
                const saved = await order.save();
                createdOrders.push(saved);
            }
        } catch (orderSaveError) {
            // Roll back stock if order creation fails to prevent stock loss
            for (const dec of decrementedList) {
                await Product.findByIdAndUpdate(dec.productId, { $inc: { stock: dec.qty } });
            }
            // Clean up any partially created orders
            for (const created of createdOrders) {
                await Order.findByIdAndDelete(created._id);
            }
            throw orderSaveError;
        }

        return res.status(201).json({ orders: createdOrders });
    } catch (error) {
        console.error('Error creating order:', error.message);
        return res.status(500).json({ message: 'Server error creating order' });
    }
};

// @desc    Cancel order (buyer only, only while Placed)
// @route   PUT /api/orders/:id/cancel
// @access  Private (Buyer)
exports.cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid order ID' });
        }

        // Atomically transition from 'Placed' to 'Cancelled' for the authenticated buyer
        // This ensures concurrent requests cannot restore stock more than once
        const updatedOrder = await Order.findOneAndUpdate(
            { _id: id, buyer: req.user._id, orderStatus: 'Placed' },
            { $set: { orderStatus: 'Cancelled' } },
            { new: true }
        );

        if (!updatedOrder) {
            // Find existing order to give a specific, user-friendly error message
            const existingOrder = await Order.findById(id);
            if (!existingOrder) {
                return res.status(404).json({ message: 'Order not found' });
            }
            if (existingOrder.buyer.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Not authorized to cancel this order' });
            }
            return res.status(400).json({
                message: `Cannot cancel order with status '${existingOrder.orderStatus}'. Orders can only be cancelled while 'Placed'.`
            });
        }

        // Atomically restore stock ONLY because this request won the atomic transition
        for (const item of updatedOrder.items) {
            await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
        }

        return res.json({ message: 'Order cancelled successfully', order: updatedOrder });
    } catch (error) {
        console.error('Error cancelling order:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update order status (vendor only, own orders only)
// @route   PUT /api/orders/:id/status
// @access  Private (Vendor)
exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { orderStatus, paymentStatus } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid order ID' });
        }

        let order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Verify authenticated vendor is the owner of this order
        if (order.vendor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to update this order' });
        }

        // Validate status transition
        if (orderStatus && orderStatus !== order.orderStatus) {
            const allowed = ALLOWED_TRANSITIONS[order.orderStatus] || [];
            if (!allowed.includes(orderStatus)) {
                return res.status(400).json({
                    message: `Invalid status transition from '${order.orderStatus}' to '${orderStatus}'`
                });
            }

            // Atomic status transition checking current status
            const currentStatus = order.orderStatus;
            const updated = await Order.findOneAndUpdate(
                { _id: id, orderStatus: currentStatus },
                { $set: { orderStatus } },
                { new: true }
            );

            if (!updated) {
                return res.status(409).json({ message: 'Order status was changed concurrently. Please refresh.' });
            }

            // If vendor cancels from Placed/Confirmed/Processing, restore stock only once
            if (orderStatus === 'Cancelled') {
                for (const item of updated.items) {
                    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
                }
            }

            order = updated;
        }

        // Validate paymentStatus: can only become 'Completed' when order is Delivered
        if (paymentStatus) {
            if (paymentStatus === 'Completed' && order.orderStatus !== 'Delivered') {
                return res.status(400).json({
                    message: 'Payment status can only be set to Completed when the order is Delivered'
                });
            }
            order.paymentStatus = paymentStatus;
            await order.save();
        }

        return res.json(order);
    } catch (error) {
        console.error('Error updating order status:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get logged in buyer orders
// @route   GET /api/orders/my-orders
// @access  Private (Buyer)
exports.getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ buyer: req.user._id })
            .populate('vendor', 'name businessName location')
            .sort({ createdAt: -1 });
        return res.json(orders);
    } catch (error) {
        console.error('Error fetching buyer orders:', error.message);
        return res.status(500).json({ message: 'Server error' });
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
        return res.json(orders);
    } catch (error) {
        console.error('Error fetching vendor orders:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid order ID' });
        }

        const order = await Order.findById(id)
            .populate('buyer', 'name email phone')
            .populate('vendor', 'name businessName location');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Only buyer or vendor of this order can view it
        const isBuyer = order.buyer._id.toString() === req.user._id.toString();
        const isVendor = order.vendor._id.toString() === req.user._id.toString();

        if (!isBuyer && !isVendor && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to view this order' });
        }

        return res.json(order);
    } catch (error) {
        console.error('Error fetching order by ID:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};
