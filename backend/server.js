require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const app = express();
app.use(express.json());
app.use(cors());

app.get('/api/health', (req,res) => {
    res.json({status: 'ok'});
});

app.use('/api/auth', require('./src/routes/authRoutes'));

const PORT = process.env.PORT || 5000;

connectDB();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});