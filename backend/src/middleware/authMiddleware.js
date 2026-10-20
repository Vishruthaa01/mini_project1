const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token and attach user to request
const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Fetch the user from the database without password
            req.user = await User.findById(decoded.id).select('-password');

            // If the token is valid but the user was deleted/no longer exists, return 401
            if (!req.user) {
                return res.status(401).json({ message: 'User no longer exists' });
            }

            // Inactive users cannot make protected requests
            if (req.user.isActive === false) {
                return res.status(403).json({ message: 'Account has been deactivated. Please contact support.' });
            }

            return next();
        } catch (error) {
            console.error('Auth protect error:', error.message);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Middleware restricting access to vendors only
const vendorOnly = (req, res, next) => {
    if (req.user && req.user.role === 'vendor') {
        return next();
    }
    return res.status(403).json({ message: 'Not authorized as a vendor' });
};

// Middleware restricting access to buyers only
const buyerOnly = (req, res, next) => {
    if (req.user && req.user.role === 'buyer') {
        return next();
    }
    return res.status(403).json({ message: 'Not authorized as a buyer' });
};

// Middleware restricting access to platform administrators only
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ message: 'Not authorized as an admin' });
};

module.exports = { protect, vendorOnly, buyerOnly, adminOnly };
