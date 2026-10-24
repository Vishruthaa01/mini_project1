require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const path = require('path');
const app = express();
const mongoose = require('mongoose');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors());

// Serve uploaded media files statically (absolute URLs built by storage.js)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.json({
        status: 'ok',
        database: states[mongoose.connection.readyState] || 'unknown',
        databaseName: mongoose.connection.name || null,
        timestamp: new Date().toISOString()
    });
});

app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/products', require('./src/routes/productRoutes'));
app.use('/api/orders', require('./src/routes/orderRoutes'));
app.use('/api/inquiries', require('./src/routes/inquiryRoutes'));
app.use('/api/reviews', require('./src/routes/reviewRoutes'));
app.use('/api/ai', require('./src/routes/aiRoutes'));
app.use('/api/admin', require('./src/routes/adminRoutes'));
app.use('/api/public', require('./src/routes/publicRoutes'));
app.use('/api/reports', require('./src/routes/reportRoutes'));

// 404 handler for unknown /api routes
app.use('/api', (req, res) => {
    return res.status(404).json({ message: 'API route not found' });
});

// Centralized error handler returning safe { message } without exposing internal 5xx details
app.use((err, req, res, next) => {
    const statusCode = err.status || err.statusCode || 500;
    if (statusCode >= 500) {
        console.error(`[Server Error ${statusCode}]`, err.stack || err.message || err);
        return res.status(statusCode).json({ message: 'Server error' });
    }
    return res.status(statusCode).json({ message: err.message || 'Request failed' });
});

const PORT = process.env.PORT || 5000;

connectDB();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});