const mongoose = require('mongoose');

/**
 * Report Model
 * ------------
 * Allows buyers and vendors to flag inappropriate products or abusive users.
 * Moderated by platform admins with status and resolution notes.
 */
const reportSchema = new mongoose.Schema(
    {
        reporter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        targetType: {
            type: String,
            enum: ['product', 'user'],
            required: true
        },
        target: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'targetModel'
        },
        targetModel: {
            type: String,
            required: true,
            enum: ['Product', 'User']
        },
        reason: {
            type: String,
            required: [true, 'Please provide a reason for this report'],
            maxlength: [500, 'Reason cannot exceed 500 characters'],
            trim: true
        },
        status: {
            type: String,
            enum: ['open', 'resolved', 'dismissed'],
            default: 'open'
        },
        adminNote: {
            type: String,
            default: '',
            trim: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Report', reportSchema);
