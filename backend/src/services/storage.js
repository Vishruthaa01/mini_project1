/**
 * Storage Service
 * ---------------
 * Handles storing uploaded and AI-processed files on disk.
 * Abstracted behind this service so it can easily be swapped for AWS S3,
 * Cloudinary, or Google Cloud Storage in the future.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Target directory on disk: backend/uploads/products/
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'products');

// Ensure directory exists at startup
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Saves a file buffer to disk with an unguessable UUID filename.
 * 
 * @param {Buffer} buffer - File data buffer
 * @param {string} extension - File extension including dot (e.g. '.webp' or '.jpg')
 * @returns {Promise<{ filename: string, absoluteUrl: string, filePath: string }>}
 */
async function saveProductImage(buffer, extension = '.webp') {
    // Generate secure random unguessable filename
    const safeExt = extension.startsWith('.') ? extension : `.${extension}`;
    const filename = `${crypto.randomUUID()}${safeExt}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Write file to disk asynchronously
    await fs.promises.writeFile(filePath, buffer);

    // Build absolute URL using PUBLIC_BASE_URL (defaults to http://localhost:5000)
    const baseUrl = (process.env.PUBLIC_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
    const absoluteUrl = `${baseUrl}/uploads/products/${filename}`;

    return {
        filename,
        absoluteUrl,
        filePath
    };
}

module.exports = {
    saveProductImage,
    UPLOAD_DIR
};
