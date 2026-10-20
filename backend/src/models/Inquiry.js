const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema(
    {
        buyer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        vendor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        subject: {
            type: String,
            required: true,
            trim: true
        },
        message: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['Open', 'Replied', 'Closed'],
            default: 'Open'
        },
        vendorReply: {
            type: String,
            default: ''
        },
        inquiryType: {
            type: String,
            enum: ['general', 'bulk'],
            default: 'general'
        },
        bulkQuantity: {
            type: Number,
            min: 1
        },
        companyName: {
            type: String,
            trim: true
        },
        quoteAmount: {
            type: Number
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Inquiry', inquirySchema);
