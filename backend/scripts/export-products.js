/**
 * Read-Only Product Dataset Exporter
 * ----------------------------------
 * Exports product records from MongoDB Atlas to a CSV file for training
 * the Stage C Machine Learning pricing model (GradientBoostingRegressor).
 * 
 * Usage (run from powershell):
 *   cd D:\mini_project1\backend
 *   node scripts/export-products.js
 * 
 * Output:
 *   D:\mini_project1\ai-service\data\products_export.csv
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../src/models/Product');

// Target directory and filename in ai-service/data
const DATA_DIR = path.join(__dirname, '..', '..', 'ai-service', 'data');
const CSV_FILE = path.join(DATA_DIR, 'products_export.csv');

// Helper to escape CSV text values
function escapeCsv(val) {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
}

async function exportProducts() {
    console.log('--> Connecting to MongoDB Atlas (read-only mode)...');

    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('[ERROR] MONGO_URI is missing from backend/.env.');
        process.exit(1);
    }

    try {
        await mongoose.connect(uri);
        console.log('--> Connected successfully. Querying products...');

        // Fetch valid products with pricing information
        const products = await Product.find({ price: { $gt: 0 } })
            .select('category rawMaterialsCost laborHours price description name')
            .lean();

        console.log(`--> Found ${products.length} products in database.`);

        // Ensure data directory exists
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        // CSV Header
        const header = [
            'id',
            'category',
            'rawMaterialsCost',
            'laborHours',
            'descriptionLength',
            'isSilk',
            'isHandwoven',
            'isBrass',
            'isCarved',
            'isSilver',
            'isTerracotta',
            'price'
        ].join(',');

        const rows = [header];

        for (const p of products) {
            const desc = (p.description || '') + ' ' + (p.name || '');
            const descLower = desc.toLowerCase();

            const row = [
                escapeCsv(p._id),
                escapeCsv(p.category || 'Other'),
                Number(p.rawMaterialsCost) || 0,
                Number(p.laborHours) || 0,
                desc.length,
                descLower.includes('silk') || descLower.includes('रेशम') ? 1 : 0,
                descLower.includes('handwoven') || descLower.includes('हथकरघा') || descLower.includes('बुना') ? 1 : 0,
                descLower.includes('brass') || descLower.includes('पीतल') ? 1 : 0,
                descLower.includes('carved') || descLower.includes('नक्काशी') ? 1 : 0,
                descLower.includes('silver') || descLower.includes('चांदी') ? 1 : 0,
                descLower.includes('terracotta') || descLower.includes('clay') || descLower.includes('मिट्टी') ? 1 : 0,
                Number(p.price)
            ].join(',');

            rows.push(row);
        }

        fs.writeFileSync(CSV_FILE, rows.join('\n'), 'utf8');
        console.log(`[SUCCESS] Exported ${products.length} rows to: ${CSV_FILE}`);

        if (products.length < 50) {
            console.log('\n[NOTE] You exported fewer than 50 real products.');
            console.log('The production Stage C model requires at least 50 real products to activate.');
            console.log('For academic evaluation, you can bootstrap a synthetic model using:');
            console.log('   python train_price_model.py --synthetic');
            console.log('The system will explicitly label it as SYNTHETIC in the logs, API, and UI.');
        }

    } catch (err) {
        console.error('[ERROR] Export failed:', err.message);
    } finally {
        await mongoose.disconnect();
        console.log('--> Disconnected from database.');
        process.exit(0);
    }
}

exportProducts();
