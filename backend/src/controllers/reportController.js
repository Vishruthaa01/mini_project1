const mongoose = require('mongoose');
const Report = require('../models/Report');
const Product = require('../models/Product');
const User = require('../models/User');

// @desc    Submit a moderation report against a product or user
// @route   POST /api/reports
// @access  Private (Buyer or Vendor)
exports.createReport = async (req, res) => {
    try {
        const { targetType, targetId, reason } = req.body;

        if (!targetType || !['product', 'user'].includes(targetType)) {
            return res.status(400).json({ message: 'Target type must be either "product" or "user"' });
        }

        if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ message: 'Valid target ID is required' });
        }

        const trimmedReason = (reason || '').trim();
        if (!trimmedReason) {
            return res.status(400).json({ message: 'Reason for reporting is required' });
        }
        if (trimmedReason.length > 500) {
            return res.status(400).json({ message: 'Reason cannot exceed 500 characters' });
        }

        const targetModel = targetType === 'product' ? 'Product' : 'User';

        // Verify target entity exists
        if (targetModel === 'Product') {
            const product = await Product.findById(targetId);
            if (!product) return res.status(404).json({ message: 'Product to report not found' });
        } else {
            const user = await User.findById(targetId);
            if (!user) return res.status(404).json({ message: 'User to report not found' });
        }

        // Avoid duplicate spam reports from the same user for the same target if open
        const existingOpen = await Report.findOne({
            reporter: req.user._id,
            target: targetId,
            status: 'open'
        });
        if (existingOpen) {
            return res.status(400).json({ message: 'You have already submitted a pending report for this item.' });
        }

        const report = await Report.create({
            reporter: req.user._id,
            targetType,
            target: targetId,
            targetModel,
            reason: trimmedReason,
            status: 'open'
        });

        return res.status(201).json({
            message: 'Report submitted successfully. Our moderation team will review it.',
            reportId: report._id
        });
    } catch (error) {
        console.error('Error creating report:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};
