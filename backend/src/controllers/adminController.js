const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Report = require('../models/Report');

// Helper to escape regex special characters
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// @desc    Admin summary metrics for dashboard
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
exports.getAdminDashboard = async (req, res) => {
    try {
        const [
            userCounts,
            productCounts,
            orderCounts,
            deliveredRevenueResult,
            openReportsCount
        ] = await Promise.all([
            // User counts by role
            User.aggregate([
                { $group: { _id: '$role', count: { $sum: 1 }, active: { $sum: { $cond: [{ $ne: ['$isActive', false] }, 1, 0] } } } }
            ]),
            // Product counts (total & hidden)
            Product.aggregate([
                { $group: { _id: null, total: { $sum: 1 }, hidden: { $sum: { $cond: ['$isHidden', 1, 0] } } } }
            ]),
            // Order counts by status
            Order.aggregate([
                { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
            ]),
            // Total revenue from Delivered orders
            Order.aggregate([
                { $match: { orderStatus: 'Delivered' } },
                { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
            ]),
            // Pending / open reports
            Report.countDocuments({ status: 'open' })
        ]);

        const usersByRole = { buyer: 0, vendor: 0, admin: 0, total: 0, inactive: 0 };
        userCounts.forEach(u => {
            if (usersByRole[u._id] !== undefined) usersByRole[u._id] = u.count;
            usersByRole.total += u.count;
            usersByRole.inactive += (u.count - u.active);
        });

        const productsSummary = {
            total: productCounts[0] ? productCounts[0].total : 0,
            hidden: productCounts[0] ? productCounts[0].hidden : 0,
            active: (productCounts[0] ? productCounts[0].total : 0) - (productCounts[0] ? productCounts[0].hidden : 0)
        };

        const ordersByStatus = {
            Placed: 0,
            Confirmed: 0,
            Processing: 0,
            Shipped: 0,
            Delivered: 0,
            Cancelled: 0,
            total: 0
        };
        orderCounts.forEach(o => {
            if (ordersByStatus[o._id] !== undefined) ordersByStatus[o._id] = o.count;
            ordersByStatus.total += o.count;
        });

        const totalRevenue = deliveredRevenueResult[0] ? deliveredRevenueResult[0].totalRevenue : 0;

        return res.json({
            users: usersByRole,
            products: productsSummary,
            orders: ordersByStatus,
            revenue: totalRevenue,
            openReports: openReportsCount
        });
    } catch (error) {
        console.error('Admin dashboard error:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    List and search users for admin moderation
// @route   GET /api/admin/users
// @access  Private (Admin only)
exports.getUsers = async (req, res) => {
    try {
        const { q, role, status, page, limit } = req.query;
        const query = {};

        if (q && q.trim()) {
            const escaped = escapeRegex(q.trim());
            query.$or = [
                { name: { $regex: escaped, $options: 'i' } },
                { email: { $regex: escaped, $options: 'i' } },
                { phone: { $regex: escaped, $options: 'i' } },
                { businessName: { $regex: escaped, $options: 'i' } }
            ];
        }

        if (role && ['buyer', 'vendor', 'admin'].includes(role)) {
            query.role = role;
        }

        if (status === 'active') {
            query.isActive = { $ne: false };
        } else if (status === 'inactive') {
            query.isActive = false;
        }

        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(limit, 10) || 15));
        const skip = (currentPage - 1) * pageSize;

        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize);

        return res.json({
            users,
            total,
            page: currentPage,
            totalPages: Math.ceil(total / pageSize) || 1
        });
    } catch (error) {
        console.error('Admin get users error:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Activate or deactivate user account
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin only)
exports.toggleUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        // Prevent self-deactivation by the requesting administrator
        if (req.user._id.toString() === id.toString() && isActive === false) {
            return res.status(400).json({ message: 'You cannot deactivate your own administrative account.' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.isActive = Boolean(isActive);
        await user.save();

        return res.json({
            message: `User account has been ${user.isActive ? 'activated' : 'deactivated'}.`,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive
            }
        });
    } catch (error) {
        console.error('Toggle user status error:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    List all products for admin oversight (includes hidden)
// @route   GET /api/admin/products
// @access  Private (Admin only)
exports.getAdminProducts = async (req, res) => {
    try {
        const { q, category, visibility, page, limit } = req.query;
        const query = {};

        if (q && q.trim()) {
            const escaped = escapeRegex(q.trim());
            query.$or = [
                { name: { $regex: escaped, $options: 'i' } },
                { description: { $regex: escaped, $options: 'i' } }
            ];
        }

        if (category) {
            query.category = category;
        }

        if (visibility === 'hidden') {
            query.isHidden = true;
        } else if (visibility === 'visible') {
            query.isHidden = { $ne: true };
        }

        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(limit, 10) || 15));
        const skip = (currentPage - 1) * pageSize;

        const total = await Product.countDocuments(query);
        const products = await Product.find(query)
            .populate('vendor', 'name businessName location email phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize);

        return res.json({
            products,
            total,
            page: currentPage,
            totalPages: Math.ceil(total / pageSize) || 1
        });
    } catch (error) {
        console.error('Admin get products error:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Hide or unhide a product from public view
// @route   PUT /api/admin/products/:id/visibility
// @access  Private (Admin only)
exports.toggleProductVisibility = async (req, res) => {
    try {
        const { id } = req.params;
        const { isHidden } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        product.isHidden = Boolean(isHidden);
        await product.save();

        return res.json({
            message: `Product is now ${product.isHidden ? 'hidden from public storefronts' : 'visible on marketplace'}.`,
            product: {
                id: product._id,
                name: product.name,
                isHidden: product.isHidden
            }
        });
    } catch (error) {
        console.error('Toggle product visibility error:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Admin orders overview
// @route   GET /api/admin/orders
// @access  Private (Admin only)
exports.getAdminOrders = async (req, res) => {
    try {
        const { status, page, limit } = req.query;
        const query = {};

        if (status) {
            query.orderStatus = status;
        }

        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(limit, 10) || 15));
        const skip = (currentPage - 1) * pageSize;

        const total = await Order.countDocuments(query);
        const orders = await Order.find(query)
            .populate('buyer', 'name email phone')
            .populate('vendor', 'name businessName phone location')
            .populate('items.product', 'name price image')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize);

        return res.json({
            orders,
            total,
            page: currentPage,
            totalPages: Math.ceil(total / pageSize) || 1
        });
    } catch (error) {
        console.error('Admin get orders error:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    List moderation reports
// @route   GET /api/admin/reports
// @access  Private (Admin only)
exports.getAdminReports = async (req, res) => {
    try {
        const { status, targetType, page, limit } = req.query;
        const query = {};

        if (status) query.status = status;
        if (targetType) query.targetType = targetType;

        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (currentPage - 1) * pageSize;

        const total = await Report.countDocuments(query);
        const reports = await Report.find(query)
            .populate('reporter', 'name email role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .lean();

        // Populate targets manually depending on targetType
        for (const report of reports) {
            if (report.targetType === 'product') {
                report.targetDetails = await Product.findById(report.target).select('name price category image isHidden').lean();
            } else if (report.targetType === 'user') {
                report.targetDetails = await User.findById(report.target).select('name email role businessName isActive').lean();
            }
        }

        return res.json({
            reports,
            total,
            page: currentPage,
            totalPages: Math.ceil(total / pageSize) || 1
        });
    } catch (error) {
        console.error('Admin get reports error:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Resolve or dismiss moderation report
// @route   PUT /api/admin/reports/:id
// @access  Private (Admin only)
exports.resolveReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNote } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid report ID' });
        }

        if (!status || !['resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ message: 'Status must be either "resolved" or "dismissed"' });
        }

        const report = await Report.findById(id);
        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        report.status = status;
        report.adminNote = (adminNote || '').trim().slice(0, 500);
        await report.save();

        return res.json({
            message: `Report has been marked as ${status}.`,
            report
        });
    } catch (error) {
        console.error('Resolve report error:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};
