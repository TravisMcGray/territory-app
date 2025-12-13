const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { validatePasswordStrength, validateEmailFormat } = require('../middleware/validation');

// GET /api/user/profile - Get current user's profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            message: 'Profile retrieved successfully',
            profile: user.toProfileJSON()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/user/profile - Update profile (firstName, lastName, avatar)
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { firstName, lastName, avatar } = req.body;
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (avatar !== undefined) user.avatar = avatar;

        await user.save();

        res.json({
            message: 'Profile updated successfully',
            profile: user.toProfileJSON()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/user/username - Change username (requires 100 hexagons)
router.put('/username', authenticateToken, async (req, res) => {
    try {
        const { newUsername } = req.body;
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!newUsername || newUsername.length < 3 || newUsername.length > 20) {
            return res.status(400).json({
                error: 'Invalid username',
                requirements: '3-20 characters, alphanumeric + underscore, start with letter'
            });
        }

        // Check if username already exists
        const existingUser = await User.findOne({ username: newUsername });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        // Check achievement: 100 hexagons captured
        if (!user.canChangeUsername()) {
            return res.status(403).json({
                error: 'Must capture 100 hexagons to change username',
                progress: `${user.stats.totalHexagonsCaptured}/100`,
                needed: 100 - user.stats.totalHexagonsCaptured
            });
        }

        user.username = newUsername;
        user.usernameChangedAt = new Date();
        await user.save();

        res.json({
            message: 'Username changed successfully',
            newUsername: user.username,
            profile: user.toProfileJSON()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/user/email - Change email (requires password verification)
router.put('/email', authenticateToken, async (req, res) => {
    try {
        const { newEmail, password } = req.body;
        const user = await User.findById(req.user.userId).select('+password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!newEmail || !password) {
            return res.status(400).json({
                error: 'New email and current password are required'
            });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        // Check if email already exists
        const existingEmail = await User.findOne({ email: newEmail.toLowerCase() });
        if (existingEmail && existingEmail._id.toString() !== user._id.toString()) {
            return res.status(409).json({ error: 'Email already in use' });
        }

        user.email = newEmail.toLowerCase();
        await user.save();

        res.json({
            message: 'Email updated successfully',
            email: user.email
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/user/password - Change password
router.put('/password', authenticateToken, validatePasswordStrength, async (req, res) => {
    try {
        const { currentPassword, password } = req.body;
        const user = await User.findById(req.user.userId).select('+password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!currentPassword) {
            return res.status(400).json({ error: 'Current password is required' });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        user.password = password; // Will be hashed by pre-save middleware
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/user/forgot-password - Request password reset
router.post('/forgot-password', validateEmailFormat, async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findByEmail(email);

        // Don't reveal if email exists (security best practice)
        if (!user) {
            return res.json({
                message: 'If an account exists with this email, reset instructions have been sent'
            });
        }

        // Generate reset token (expires in 1 hour)
        const resetToken = jwt.sign(
            { userId: user._id, type: 'password-reset' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // TODO: Send reset email with token
        // Email should contain: http://frontend.com/reset-password?token=resetToken
        console.log(`📧 TODO: Send reset email to ${email} with token: ${resetToken}`);

        res.json({
            message: 'If an account exists with this email, reset instructions have been sent'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/user/reset-password - Reset password with token
router.post('/reset-password', validatePasswordStrength, async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Reset token is required' });
        }

        // Verify reset token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        if (decoded.type !== 'password-reset') {
            return res.status(403).json({ error: 'Invalid token type' });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.password = password; // Will be hashed by pre-save middleware
        await user.save();

        res.json({
            message: 'Password reset successful. You can now login with your new password.'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/user/account - Delete user account
router.delete('/account', authenticateToken, async (req, res) => {
    try {
        const { password } = req.body;
        const user = await User.findById(req.user.userId).select('+password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!password) {
            return res.status(400).json({ error: 'Password is required to delete account' });
        }

        // Verify password before deletion
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        // Soft delete (set isActive to false instead of hard delete)
        user.isActive = false;
        await user.save();

        res.json({
            message: 'Account deleted successfully. All your data has been removed.'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;