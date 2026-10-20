const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');

/**
 * Public Controller
 * -----------------
 * Handles unauthenticated public storefront requests.
 * Exposes ONLY safe artisan profile fields (never email, phone, or password).
 */

// @desc    Get public vendor storefront details & products
// @route   GET /api/public/store/:vendorId
// @access  Public
exports.getVendorStorefront = async (req, res) => {
    try {
        const { vendorId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(vendorId)) {
            return res.status(400).json({ message: 'Invalid vendor ID' });
        }

        // Fetch vendor - safe fields only! NEVER expose email or phone to unauthenticated visitors
        const vendor = await User.findOne({
            _id: vendorId,
            role: 'vendor',
            isActive: { $ne: false }
        }).select('businessName name craftCategory location about createdAt');

        if (!vendor) {
            return res.status(404).json({ message: 'Artisan storefront not found or inactive' });
        }

        // Fetch non-hidden products belonging to this vendor
        const products = await Product.find({
            vendor: vendorId,
            isHidden: { $ne: true }
        })
        .select('-rawMaterialsCost -laborHours')
        .sort({ createdAt: -1 });

        return res.json({
            vendor: {
                id: vendor._id,
                businessName: vendor.businessName || vendor.name,
                artisanName: vendor.name,
                craftCategory: vendor.craftCategory || 'Traditional Crafts',
                location: vendor.location || 'India',
                about: vendor.about || 'Welcome to our digital artisan storefront!',
                memberSince: vendor.createdAt
            },
            products
        });
    } catch (error) {
        console.error('Error fetching public storefront:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};
