const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { authenticateToken, JWT_SECRET } = require ('../middleware/auth');
const {
    validatePasswordStrength,
    validateEmailFormat,
    validateUsernameFormat,
    validatePassword 
} = require('../middleware/validation');

// GET /api/users/profile - Get current user's profile (protected)
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        res.json({
            message: 'Profile retrieved successfully',
            profile: user.getProfile()
        });
    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    } 
});

//PUT /api/users/profile - Update profile (firstname, lastname, avatar) (protected)
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { firstname, lastname, avatar } = req.body;
        const user = await user.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        //Update allowed fields :)
        if (firstname !== undefined) user.firstname = firstname;
        if (lastname !== undefined) user.lastname = lastname;
        if (avatar !== undefined) user.avater = avater;

        await user.save();

        res.json({
        message: 'Profile updated successfully',
        profile: user.getProfile()
        });
    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

// PUT /api/users/username - Chance username (requires 100 hexagons) (protected)
router.put('/username', authenticateToken, async (req, res) => {
    try {
        const { newUsername } = req.body;
        const User = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        //Validate username format
        const { validateUsername } = require ('../middleware/validation')
        if (!validateUsername(newUsername)) {
            return res.status(400).json({
                error: 'Invalid username',
                requirements: '3-20 characters, alphanumeric + underscore, start with letter'
            });
        }

        // Check if username already exists
        const existingUser = await User.findOne({
            username: newUsername
        })
        if (existingUser) {
            return res.status(400).json({
                error: 'Username already taken'
            });
        }

        // Check achievement: 100 hexagons captured
        if (!user.canChangeUsername()) {
            return res.status(403).json({
                error: 'Must capture 100 hexagons to change username',
                progress: `${user.totalHexagonsCaptuted}/100`,
                needed: 100 - user.totalHexagonsCaptured
            });
        }

        // Update username
        user.username = newUsername
        user.usernameChangeAt = new Date();
        await user.save();

        res.json({
            message: 'Username changed successfully',
            newUsername: user.username,
            profile: user.getProfile()
        });
    } catch (err) {
        res. status(500).json({ 
            error: err.message 
        });
    }
});

// PUT /api/users/email - Change email (requires verification) (protected)
router.put('/email', authenticateToken, validateEmailFormat, async (req, res) => {
    try {
        const { newEmail, password } = req.body;
        const user = await User.findById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        //Verify current password (security)
        if (!password) {
            return res.status(400).json({
                error: 'Current password required to change email'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Incorrect password'
            });
        }

        // Check if new email already exists
        const existingUser = await User.findOne({ email: newEmail });
        if (!existingUser) {
            return res.status(400).json({
                error: 'Email already in use'
            });
        }

        // TODO: Send verification email to newEmail with token
        // For now, just update directly
        user.email = newEmail;
        await user.save();

        res.json({
            message: 'Email updated successfully',
            email: user.email
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/users/password - Change password (protected)
router.put('/password', authenticateToken, validatePasswordStrength, async (req, res) => {
    try {
        const { currentPassword, password } = req.body;
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        if (!currentPassword) {
            return res.status(400).json({
                error: 'Current password required'
            });
        }

        const isPasswordValid = await bcrypt.compare(currentPasswrod, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Current password is incorrect'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/users/forgot-password - Request password Request
router.post('/forgot-password', validateEmailFormat, async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            // Don't reveal if email exists (this is to ensure security and is also a best practice)
            return res.json({
                message: 'If an account exists with this email, reset instructions have been sent'
            });
        }

        // Generate reset Token (expires in 1 hour)
        const resetToken = jwt.sign(
            { userId: user._id, type: 'password-reset' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // TODO: Send reset email token
        // Email shoud contain link: http://frontend.com/reset-password?token=resetToken
        console.log(`TODO: Send reset email to ${email} with token: ${resetToken}`);

        res.json({
            message: 'If an account exists with this email, reset instructions have been sent'
        });
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
});

// POST /api/users/reset-password - Reset password with token
router.post('/reset-password', validatePasswordStrength, async (req, res) => {
    try { 
        const { token, password } = req.body;

        if (!token) {
            return res.status(400).json({
                error: 'Reset token required'
            });
        }

        // Verify reset token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(403).json({
                error: 'Invalid token type'
            });
        }

        // Verify it's a password-reset token
        if (decoded.type !== 'password-reset') {
            return res.status(403).json({
                error: 'Invalid token type'
            });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        // Hash and save new password 
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({
            message: 'Password reset successful. You can now login with your new password.'
        });
    } catch (err) {
        res.status(500).json({ 
            error: err.message 
        });
    }
});

// DELETE /api/users/account - Delete user account (protected)
router.delete('/account', authenticateToken, async (req, res) => {
    try {
        const { password } = req.body;
        const user =await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        // Verify password before deletion
        if (!password) {
            return res.status(400).json({
                error: 'Password required to delete account'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Incorrect password'
            });
        }

        // Delete user (and optionally their walks/territory data)
        await User.findByIdAndDelete(req.user.userId);

        res.json({
            message: 'Account deleted successfully. All your data has been removed.'
        });
    } catch (err) {
        res.status(500).json({ 
            error: err.message
        });
    }
});

module.exports = router;