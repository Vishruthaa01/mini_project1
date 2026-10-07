const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: [
            'Textiles & Handloom',
            'Pottery & Clay Art',
            'Woodcraft',
            'Handmade Jewelry',
            'Bamboo & Cane',
        ]
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String
    },
    rawMaterialsCost: {
        type: Number,
        min: 0
    },
    laborHours: {
        type: Number,
        min: 0
    },
    price: {
        type: Number,
        required: true,
        min: 1
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 1
    },
    sku: {
        type: String,
        trim: true,
    },
    },
    { 
        timestamps: true 
    }
);

module.exports = mongoose.model("Product", productSchema);