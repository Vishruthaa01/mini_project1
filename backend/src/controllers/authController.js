const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper to normalize phone numbers (strip spaces, dashes, and parentheses)
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/[\s\-\(\)]/g, '').trim();
}

function createToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    businessName: user.businessName || '',
    craftCategory: user.craftCategory || '',
    location: user.location || '',
    about: user.about || '',
    isProfileComplete: Boolean(user.isProfileComplete),
  };
}

exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const safeRole = role === 'vendor' ? 'vendor' : 'buyer';
    const normEmail = email.toLowerCase().trim();
    const normPhone = normalizePhone(phone);

    if (!normPhone) {
      return res.status(400).json({ message: 'Valid phone number is required' });
    }

    const existing = await User.findOne({
      $or: [{ email: normEmail }, { phone: normPhone }],
    });
    if (existing) {
      return res.status(409).json({ message: 'Email or phone already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normEmail,
      phone: normPhone,
      password: hashedPassword,
      role: safeRole,
      isProfileComplete: false,
    });

    res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email or phone already registered' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Signup error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email/phone and password are required' });
    }

    const trimmedId = identifier.trim();
    const query = trimmedId.includes('@')
      ? { email: trimmedId.toLowerCase() }
      : { phone: normalizePhone(trimmedId) };

    const user = await User.findOne(query);
    const passwordOk = user && (await bcrypt.compare(password, user.password));

    if (!passwordOk) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name !== undefined ? req.body.name.trim() : user.name;
      user.businessName = req.body.businessName !== undefined ? req.body.businessName.trim() : user.businessName;
      user.craftCategory = req.body.craftCategory !== undefined ? req.body.craftCategory.trim() : user.craftCategory;
      if (req.body.email !== undefined) {
        user.email = req.body.email.toLowerCase().trim();
      }
      if (req.body.phone !== undefined) {
        user.phone = normalizePhone(req.body.phone);
      }
      user.location = req.body.location !== undefined ? req.body.location.trim() : user.location;
      user.about = req.body.about !== undefined ? req.body.about.trim() : user.about;
      user.isProfileComplete = true;

      const updatedUser = await user.save();
      res.json(publicUser(updatedUser));
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email or phone already registered' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Update profile error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Change password for logged-in user
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password must be different from current password' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};