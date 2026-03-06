const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Territory = require('../models/territory');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { validatePasswordStrength, validateEmailFormat } = require('../middleware/validation');

// GET /api/user/profile - Get current user's profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
            status: 'error',
            code: 'USER_NOT_FOUND',
            message: 'User not found'
        });
        }

        return res.json({
            message: 'Profile retrieved successfully',
            profile: user.toProfileJSON()
        });

    } catch (err) {
        return res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error retrieving profile'
        });
    }
});

// PUT /api/user/profile - Update profile (firstName, lastName, avatar)
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { firstName, lastName, avatar } = req.body;
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (avatar !== undefined) user.avatar = avatar;

        await user.save();

        return res.json({
            message: 'Profile updated successfully',
            profile: user.toProfileJSON()
        });
    } catch (err) {
        return res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error updating profile'
        });
    }
});

// PUT /api/user/username - Change username (requires 100 hexagons)
router.put('/username', authenticateToken, async (req, res) => {
    try {
        const { newUsername } = req.body;
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        if (!newUsername || newUsername.length < 3 || newUsername.length > 20) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_USERNAME',
                message: 'Username must be 3-20 characters, alphanumeric + underscore, start with letter'
            });
        }

        // Check if username already exists
        const existingUser = await User.findOne({ username: newUsername });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
            return res.status(409).json({
                status: 'error',
                code: 'USERNAME_TAKEN',
                message: 'Username already taken'
            });
        }

        // Check achievement: 100 hexagons captured
        if (!user.canChangeUsername()) {
            return res.status(403).json({
                status: 'error',
                code: 'INSUFFICIENT_HEXAGONS',
                message: `Must capture 100 hexagons to change username. Progress: ${user.stats.totalHexagonsCaptured}/100`
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
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error updating username'
        });
    }
});

// PUT /api/user/email - Change email (requires password verification)
router.put('/email', authenticateToken, async (req, res) => {
    try {
        const { newEmail, password } = req.body;
        const user = await User.findById(req.user.userId).select('+password');

        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        if (!newEmail || !password) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_FIELDS',
                message: 'New email and current password are required'
            });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                status: 'error',
                code: 'INCORRECT_PASSWORD',
                message: 'Incorrect password'
            });
        }

        // Check if email already exists
        const existingEmail = await User.findOne({ email: newEmail.toLowerCase() });
        if (existingEmail && existingEmail._id.toString() !== user._id.toString()) {
            return res.status(409).json({
                status: 'error',
                code: 'EMAIL_IN_USE',
                message: 'Email already in use'
            });
        }

        user.email = newEmail.toLowerCase();
        await user.save();

        res.json({
            message: 'Email updated successfully',
            email: user.email
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error updating email'
        });
    }
});

// PUT /api/user/password - Change password
router.put('/password', authenticateToken, validatePasswordStrength, async (req, res) => {
    try {
        const { currentPassword, password } = req.body;
        const user = await User.findById(req.user.userId).select('+password');

        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        if (!currentPassword) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_FIELDS',
                message: 'Current password is required'
            });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                status: 'error',
                code: 'INCORRECT_PASSWORD',
                message: 'Current password is incorrect'
            });
        }

        user.password = password; // Will be hashed by pre-save middleware
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error updating password'
        });
    }
});

// POST /api/user/forgot-password - Request password reset
router.post('/forgot-password', validateEmailFormat, async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findByEmail(email);

        // Don't reveal if email exists (security best practice)
        // Always return same message whether user exists or not
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

        // Build reset URL using frontend env var
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

        // Send reset email via Resend
        await resend.emails.send({
            from: 'TerritoryCapture <onboarding@resend.dev>',
            to: user.email,
            subject: 'Reset your TerritoryCapture password',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #10b981;">TerritoryCapture</h2>
                    <p>Hi ${user.username},</p>
                    <p>You requested a password reset. Click the button below to reset your password.</p>
                    <p>This link expires in <strong>1 hour</strong>.</p>
                    <a href="${resetUrl}" 
                        style="display: inline-block; background: #10b981; color: white; 
                                padding: 12px 24px; border-radius: 8px; text-decoration: none; 
                                font-weight: bold; margin: 16px 0;">
                        Reset Password
                    </a>
                    <p>If you didn't request this, you can safely ignore this email.</p>
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style="color: #6b7280; font-size: 12px;">${resetUrl}</p>
                </div>
            `
        });

        return res.json({
            message: 'If an account exists with this email, reset instructions have been sent'
        });

    } catch (err) {
        return res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error processing password reset request'
        });
    }
});

// POST /api/user/reset-password - Reset password with token
router.post('/reset-password', validatePasswordStrength, async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_TOKEN',
                message: 'Reset token is required'
            });
        }

        // Verify reset token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(403).json({
                status: 'error',
                code: 'INVALID_TOKEN',
                message: 'Invalid or expired token'
            });
        }

        if (decoded.type !== 'password-reset') {
            return res.status(403).json({
                status: 'error',
                code: 'INVALID_TOKEN_TYPE',
                message: 'Invalid token type'
            });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        user.password = password; // Will be hashed by pre-save middleware
        await user.save();

        res.json({
            message: 'Password reset successful. You can now login with your new password.'
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error resetting password'
        });
    }
});

// DELETE /api/user/account - Delete user account
router.delete('/account', authenticateToken, async (req, res) => {
    try {
        const { password } = req.body;
        const user = await User.findById(req.user.userId).select('+password');

        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        if (!password) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_FIELDS',
                message: 'Password is required to delete account'
            });
        }

        // Verify password before deletion
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                status: 'error',
                code: 'INCORRECT_PASSWORD',
                message: 'Incorrect password'
            });
        }

        // Soft delete (set isActive to false instead of hard delete)
        user.isActive = false;
        await user.save();

        res.json({
            message: 'Account deactivated successfully. Your data will be removed shortly.'
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error deleting account'
        });
    }
});

// ========== GET /api/user/territories - Get all captured territories for the map ==========
// Returns every hex tile in the database with owner info so the frontend
// can render the full global territory map using H3 polygon boundaries.
router.get('/territories', authenticateToken, async (req, res) => {
    try {
        const territories = await Territory.find({ 'ownerId': { $exists: true } })
            .populate({ path: 'ownerId', match: { isActive: true }, select: 'username' })
            .select('hexagonId ownerId ownerActivityType capturedAt')
            .lean();

        const formatted = territories
            .filter(t => t.ownerId !== null)
            .map(t => ({
                hexagonId: t.hexagonId,
                owner: {
                    id: t.ownerId._id,
                    username: t.ownerId.username
                },
                activityType: t.ownerActivityType,
                capturedAt: t.capturedAt
            }));

        res.json({
            message: 'Territories retrieved successfully',
            count: formatted.length,
            territories: formatted
        });

    } catch (err) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error retrieving territories'
        });
    }
});

module.exports = router;