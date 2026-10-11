const Inquiry = require('../models/Inquiry');
const Product = require('../models/Product');

// @desc    Create an inquiry (buyer to artisan)
// @route   POST /api/inquiries
// @access  Private (Buyer)
exports.createInquiry = async (req, res) => {
    try {
        const { vendor, product, subject, message } = req.body;

        if (!vendor || !subject || !message) {
            return res.status(400).json({ message: 'Vendor, subject, and message are required' });
        }

        const inquiry = new Inquiry({
            buyer: req.user._id,
            vendor,
            product: product || null,
            subject,
            message,
            status: 'Open'
        });

        const savedInquiry = await inquiry.save();
        res.status(201).json(savedInquiry);
    } catch (error) {
        console.error('Error creating inquiry:', error);
        res.status(500).json({ message: 'Server error' });
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
        res.json(inquiries);
    } catch (error) {
        console.error('Error getting buyer inquiries:', error);
        res.status(500).json({ message: 'Server error' });
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
        res.json(inquiries);
    } catch (error) {
        console.error('Error getting vendor inquiries:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Reply to inquiry
// @route   PUT /api/inquiries/:id/reply
// @access  Private (Vendor)
exports.replyInquiry = async (req, res) => {
    try {
        const { reply } = req.body;
        const inquiry = await Inquiry.findById(req.params.id);

        if (!inquiry) {
            return res.status(404).json({ message: 'Inquiry not found' });
        }

        if (inquiry.vendor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        inquiry.vendorReply = reply;
        inquiry.status = 'Replied';
        const updated = await inquiry.save();
        res.json(updated);
    } catch (error) {
        console.error('Error replying to inquiry:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
