const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name : { 
        type: String, 
        required: true, 
        trim: true 
    },
    email : {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone : { 
        type: String, 
        required: true, 
        trim: true
    },
    password : { 
        type: String,
        required: true, 
        minlength: 6 
    },
    role : {
      type: String,
      enum: ['vendor', 'buyer', 'admin'],
      default: 'buyer',
    },

    businessName : { 
        type: String, 
        trim: true
    },
    craftCategory : { 
        type: String, 
        trim: true 
    },
    location : { 
        type: String, 
        trim: true 
    },
    about : {
        type: String,
        trim: true 
    },
  },
    { 
    timestamps: true 
    }
);

module.exports = mongoose.model('User', userSchema);