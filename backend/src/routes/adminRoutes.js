const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
    getAdminDashboard,
    getUsers,
    toggleUserStatus,
    getAdminProducts,
    toggleProductVisibility,
    getAdminOrders,
    getAdminReports,
    resolveReport
} = require('../controllers/adminController');

// All admin routes strictly require valid JWT and admin role
router.use(protect, adminOnly);

router.get('/dashboard', getAdminDashboard);
router.get('/users', getUsers);
router.put('/users/:id/status', toggleUserStatus);
router.get('/products', getAdminProducts);
router.put('/products/:id/visibility', toggleProductVisibility);
router.get('/orders', getAdminOrders);
router.get('/reports', getAdminReports);
router.put('/reports/:id', resolveReport);

module.exports = router;
