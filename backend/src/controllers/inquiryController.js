const mongoose = require('mongoose');
const Inquiry = require('../models/Inquiry');
const Product = require('../models/Product');
const User = require('../models/User');

// @desc    Create an inquiry (buyer to artisan)
// @route   POST /api/inquiries
// @access  Private (Buyer)
exports.createInquiry = async (req, res) => {
    try {
        const { vendor, product, subject, message } = req.body;

        // 1. Verify vendor exists and has role 'vendor'
        if (!vendor || !mongoose.Types.ObjectId.isValid(vendor)) {
            return res.status(400).json({ message: 'Valid vendor ID is required' });
        }

        const vendorDoc = await User.findById(vendor);
        if (!vendorDoc || vendorDoc.role !== 'vendor') {
            return res.status(400).json({ message: 'Target user is not a valid vendor' });
        }

        // 2. If product is given, verify it exists and belongs to that vendor
        let productObjId = null;
        if (product) {
            if (!mongoose.Types.ObjectId.isValid(product)) {
                return res.status(400).json({ message: 'Invalid product ID' });
            }
            const productDoc = await Product.findById(product);
            if (!productDoc) {
                return res.status(404).json({ message: 'Product not found' });
            }
            if (productDoc.vendor.toString() !== vendor.toString()) {
                return res.status(400).json({ message: 'Product does not belong to the specified vendor' });
            }
            productObjId = productDoc._id;
        }

        // 3. Validate subject: non-empty, trimmed, max 100 characters
        const trimmedSubject = (subject || '').trim();
        if (!trimmedSubject) {
            return res.status(400).json({ message: 'Subject is required' });
        }
        if (trimmedSubject.length > 100) {
            return res.status(400).json({ message: 'Subject must be at most 100 characters' });
        }

        // 4. Validate message: non-empty, trimmed, max 1000 characters
        const trimmedMessage = (message || '').trim();
        if (!trimmedMessage) {
            return res.status(400).json({ message: 'Message is required' });
        }
        if (trimmedMessage.length > 1000) {
            return res.status(400).json({ message: 'Message must be at most 1000 characters' });
        }

        const inquiry = new Inquiry({
            buyer: req.user._id,
            vendor: vendorDoc._id,
            product: productObjId,
            subject: trimmedSubject,
            message: trimmedMessage,
            status: 'Open'
        });

        const savedInquiry = await inquiry.save();
        return res.status(201).json(savedInquiry);
    } catch (error) {
        console.error('Error creating inquiry:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get buyer inquiries
// @route   GET /api/inquiries/buyer
// @access  Private (Buyer)
exports.getBuyerInquiries = async (req, res) => {
    try {
        const inquiries = await Inquiry.find({ buyer: req.user._id })
            .populate('vendor', 'name businessName location')
            .populate('product', 'name price image')
            .sort({ createdAt: -1 });
        return res.json(inquiries);
    } catch (error) {
        console.error('Error getting buyer inquiries:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get vendor inquiries
// @route   GET /api/inquiries/vendor
// @access  Private (Vendor)
exports.getVendorInquiries = async (req, res) => {
    try {
        const inquiries = await Inquiry.find({ vendor: req.user._id })
            .populate('buyer', 'name email phone')
            .populate('product', 'name price image')
            .sort({ createdAt: -1 });
        return res.json(inquiries);
    } catch (error) {
        console.error('Error getting vendor inquiries:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Reply to inquiry (only assigned vendor)
// @route   PUT /api/inquiries/:id/reply
// @access  Private (Vendor)
exports.replyInquiry = async (req, res) => {
    try {
        const { id } = req.params;
        const { reply } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid inquiry ID' });
        }

        const inquiry = await Inquiry.findById(id);
        if (!inquiry) {
            return res.status(404).json({ message: 'Inquiry not found' });
        }

        // Only the vendor of this inquiry is authorized to reply
        if (inquiry.vendor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to reply to this inquiry' });
        }

        const trimmedReply = (reply || '').trim();
        if (!trimmedReply) {
            return res.status(400).json({ message: 'Reply cannot be empty' });
        }
        if (trimmedReply.length > 1000) {
            return res.status(400).json({ message: 'Reply must be at most 1000 characters' });
        }

        inquiry.vendorReply = trimmedReply;
        inquiry.status = 'Replied';
        const updated = await inquiry.save();
        return res.json(updated);
    } catch (error) {
        console.error('Error replying to inquiry:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};
