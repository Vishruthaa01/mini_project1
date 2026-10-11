const mongoose = require('mongoose');

async function connectDB() {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB connected: ${conn.connection.host} (DB: ${conn.connection.name})`);
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1); 
    }
}

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected.');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

module.exports = connectDB;