require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const app = express();
const mongoose = require('mongoose');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

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

const PORT = process.env.PORT || 5000;

connectDB();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});