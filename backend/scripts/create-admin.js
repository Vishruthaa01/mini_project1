/**
 * Admin Creation Script
 * ---------------------
 * Creates or updates an administrative user in MongoDB.
 * Admin accounts can NEVER be created via the public signup form.
 *
 * HOW TO RUN (PowerShell):
 * $env:ADMIN_NAME="Platform Admin"
 * $env:ADMIN_EMAIL="admin@vendorconnect.local"
 * $env:ADMIN_PASSWORD="YourSecureAdminPassword123"
 * $env:ADMIN_PHONE="9876543210"
 * node backend/scripts/create-admin.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const name = process.env.ADMIN_NAME || 'Platform Administrator';
const email = (process.env.ADMIN_EMAIL || 'admin@vendorconnect.local').toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD;
const phone = (process.env.ADMIN_PHONE || '9876543210').replace(/\D/g, '');

async function createAdmin() {
    if (!process.env.MONGO_URI) {
        console.error('ERROR: MONGO_URI is not set in environment or backend/.env');
        process.exit(1);
    }

    if (!password || password.length < 6) {
        console.error('ERROR: Please provide an ADMIN_PASSWORD of at least 6 characters.');
        console.log('Example: $env:ADMIN_PASSWORD="SecurePassword123"; node backend/scripts/create-admin.js');
        process.exit(1);
    }

    try {
        console.log('Connecting to MongoDB database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected successfully.');

        const User = require('../src/models/User');

        const hashedPassword = await bcrypt.hash(password, 10);

        let user = await User.findOne({ email });
        if (user) {
            console.log(`User with email "${email}" exists. Promoting to admin and updating password...`);
            user.role = 'admin';
            user.isActive = true;
            user.password = hashedPassword;
            user.name = name;
            user.phone = phone;
            await user.save();
            console.log(`✓ Admin user "${email}" updated successfully!`);
        } else {
            user = await User.create({
                name,
                email,
                phone,
                password: hashedPassword,
                role: 'admin',
                isActive: true,
                isProfileComplete: true
            });
            console.log(`✓ Admin user "${email}" created successfully!`);
        }

        console.log('\nAdmin Details:');
        console.log('  Name:    ', user.name);
        console.log('  Email:   ', user.email);
        console.log('  Phone:   ', user.phone);
        console.log('  Role:    ', user.role);
        console.log('  Status:  ', user.isActive ? 'Active' : 'Inactive');
        console.log('\nYou can now log in at /frontend/authentication/login.html with these credentials.\n');
    } catch (err) {
        console.error('Failed to create admin user:', err.message);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    }
}

createAdmin();
