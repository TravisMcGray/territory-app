const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Territory = require('../models/territory');
const Activity = require('../models/activity');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { validatePasswordStrength, validateEmailFormat } = require('../middleware/validation');
const { validateUsername } = require('../middleware/profanity');
const { cellToBoundary } = require('h3-js');

// Lazy-load social models
let ActivityComment, ActivityKudos, Notification;
try { ActivityComment = require('../models/activityComment'); } catch {}
try { ActivityKudos = require('../models/activityKudos'); } catch {}
try { Notification = require('../models/notification'); } catch {}

// ========== GET /api/user/profile ==========
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const [user, tilesOwned] = await Promise.all([
            User.findById(req.user.userId),
            Territory.countDocuments({ ownerId: req.user.userId }),
        ]);
        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }
        return res.json({
            message: 'Profile retrieved successfully',
            profile: { ...user.toProfileJSON(), tilesOwned },
        });
    } catch (err) {
        return res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error retrieving profile'
        });
    }
});

// ========== PUT /api/user/privacy ==========
router.put('/privacy', authenticateToken, async (req, res) => {
    try {
        const { activityPrivacy } = req.body;
        if (!['public', 'followers', 'private'].includes(activityPrivacy)) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_PRIVACY',
                message: 'activityPrivacy must be public, followers, or private'
            });
        }
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }
        user.activityPrivacy = activityPrivacy;
        await user.save();
        res.json({ message: 'Privacy setting updated', activityPrivacy: user.activityPrivacy });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error updating privacy setting'
        });
    }
});

// ========== PUT /api/user/profile ==========
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
        if (avatar !== undefined) {
            if (avatar !== null && !avatar.startsWith('https://')) {
                return res.status(400).json({
                    status: 'error',
                    code: 'INVALID_AVATAR_URL',
                    message: 'Avatar URL must start with https://'
                });
            }
            user.avatar = avatar;
        }
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

// ========== PUT /api/user/body-stats ==========
// Updates optional body measurements for calorie/distance accuracy.
// All fields are optional — users only set what they want.
router.put('/body-stats', authenticateToken, async (req, res) => {
    try {
        const { weight, age, sex, heightFeet, heightInches, stepLength } = req.body;
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        // Validate and set each field only if provided
        if (weight !== undefined) {
            if (typeof weight !== 'number' || weight < 50 || weight > 1000) {
                return res.status(400).json({
                    status: 'error',
                    code: 'INVALID_WEIGHT',
                    message: 'Weight must be between 50 and 1000 lbs'
                });
            }
            user.weight = weight;
        }

        if (age !== undefined) {
            if (typeof age !== 'number' || age < 13 || age > 120) {
                return res.status(400).json({
                    status: 'error',
                    code: 'INVALID_AGE',
                    message: 'Age must be between 13 and 120'
                });
            }
            user.age = age;
        }

        if (sex !== undefined) {
            if (!['male', 'female', 'prefer_not_to_say'].includes(sex)) {
                return res.status(400).json({
                    status: 'error',
                    code: 'INVALID_SEX',
                    message: 'Sex must be male, female, or prefer_not_to_say'
                });
            }
            user.sex = sex;
        }

        if (heightFeet !== undefined) {
            if (typeof heightFeet !== 'number' || heightFeet < 3 || heightFeet > 8) {
                return res.status(400).json({
                    status: 'error',
                    code: 'INVALID_HEIGHT',
                    message: 'Height (feet) must be between 3 and 8'
                });
            }
            user.heightFeet = heightFeet;
        }

        if (heightInches !== undefined) {
            if (typeof heightInches !== 'number' || heightInches < 0 || heightInches > 11) {
                return res.status(400).json({
                    status: 'error',
                    code: 'INVALID_HEIGHT',
                    message: 'Height (inches) must be between 0 and 11'
                });
            }
            user.heightInches = heightInches;
        }

        if (stepLength !== undefined) {
            if (typeof stepLength !== 'number' || stepLength < 10 || stepLength > 50) {
                return res.status(400).json({
                    status: 'error',
                    code: 'INVALID_STEP_LENGTH',
                    message: 'Step length must be between 10 and 50 inches'
                });
            }
            user.stepLength = stepLength;
        }

        await user.save();

        res.json({
            message: 'Body stats updated successfully',
            profile: user.toProfileJSON()
        });

    } catch (err) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error updating body stats'
        });
    }
});

// ========== PUT /api/user/username ==========
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

        // Validate format + profanity in one call
        const usernameCheck = validateUsername(newUsername);
        if (!usernameCheck.valid) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_USERNAME',
                message: usernameCheck.message
            });
        }

        const existingUser = await User.findOne({ username: newUsername });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
            return res.status(409).json({
                status: 'error',
                code: 'USERNAME_TAKEN',
                message: 'Username already taken'
            });
        }

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

// ========== PUT /api/user/email ==========
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
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                status: 'error',
                code: 'INCORRECT_PASSWORD',
                message: 'Incorrect password'
            });
        }
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
        res.json({ message: 'Email updated successfully', email: user.email });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error updating email'
        });
    }
});

// ========== PUT /api/user/password ==========
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
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                status: 'error',
                code: 'INCORRECT_PASSWORD',
                message: 'Current password is incorrect'
            });
        }
        user.password = password;
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

// ========== POST /api/user/forgot-password ==========
router.post('/forgot-password', validateEmailFormat, async (req, res) => {
    try {
        const { email } = req.body;

        // Always return the same response — don't reveal whether email exists
        const genericResponse = {
            message: 'If an account exists with this email, reset instructions have been sent.'
        };

        const user = await User.findByEmail(email)
            .select('+passwordResetToken +passwordResetExpires');
        if (!user) return res.json(genericResponse);

        // Generate raw token (for email) and hashed token (for DB)
        const raw = crypto.randomBytes(32).toString('hex');
        const hashed = crypto.createHash('sha256').update(raw).digest('hex');

        user.passwordResetToken = hashed;
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await user.save();

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${raw}`;
        await resend.emails.send({
            from: 'HexCapture <noreply@hexcapture.com>',
            to: user.email,
            subject: 'Reset your HexCapture password',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #030712; color: #ffffff; padding: 32px; border-radius: 16px;">
                    <h2 style="color: #10b981;">HexCapture</h2>
                    <p style="color: #9ca3af;">Hi ${user.username},</p>
                    <p style="color: #9ca3af;">You requested a password reset. Click the button below to reset your password.</p>
                    <p style="color: #9ca3af;">This link expires in <strong style="color: #ffffff;">1 hour</strong>.</p>
                    <a href="${resetUrl}"
                        style="display: inline-block; background: #10b981; color: white;
                                padding: 12px 24px; border-radius: 8px; text-decoration: none;
                                font-weight: bold; margin: 16px 0;">
                        Reset Password
                    </a>
                    <p style="color: #6b7280; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
                    <p style="color: #6b7280; font-size: 12px;">If the button doesn't work, copy and paste this link:<br>${resetUrl}</p>
                </div>
            `
        });

        return res.json(genericResponse);
    } catch (err) {
        return res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error processing password reset request'
        });
    }
});

// ========== POST /api/user/reset-password ==========
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

        // Hash the raw token from the URL to compare against DB
        const hashed = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashed,
            passwordResetExpires: { $gt: new Date() }
        }).select('+passwordResetToken +passwordResetExpires');

        if (!user) {
            return res.status(403).json({
                status: 'error',
                code: 'INVALID_TOKEN',
                message: 'Invalid or expired reset link. Please request a new one.'
            });
        }

        // Set new password and clear the token — single use, now invalidated
        user.password = password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        res.json({ message: 'Password reset successful. You can now login with your new password.' });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error resetting password'
        });
    }
});

// ========== POST /api/user/account/delete-request ==========
// Step 1 of self-deletion: generates a 6-digit code, hashes it, emails it.
// Code expires in 15 minutes.
router.post('/account/delete-request', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Hash before storing — never store raw codes
        const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

        // Store hashed code with 15 minute expiry
        user.accountDeletionCode = hashedCode;
        user.accountDeletionExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        // Send email with the raw code
        await resend.emails.send({
            from: 'HexCapture <noreply@hexcapture.com>',
            to: user.email,
            subject: 'Confirm account deletion — HexCapture',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #030712; color: #ffffff; padding: 32px; border-radius: 16px;">
                    <h2 style="color: #ef4444;">HexCapture</h2>
                    <h3 style="color: #ffffff;">Account Deletion Request</h3>
                    <p style="color: #9ca3af;">Hi ${user.username},</p>
                    <p style="color: #9ca3af;">We received a request to permanently delete your HexCapture account.</p>
                    <p style="color: #9ca3af;"><strong style="color: #ffffff;">This action cannot be undone.</strong> The following will be permanently deleted:</p>
                    <ul style="color: #9ca3af; padding-left: 20px;">
                        <li>Your account and profile</li>
                        <li>All captured territories</li>
                        <li>All activities and routes</li>
                        <li>All comments and kudos</li>
                        <li>All followers and following</li>
                    </ul>
                    <p style="color: #9ca3af;">Enter this code in the app to confirm:</p>
                    <div style="background: #1f2937; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                        <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #ef4444;">${code}</span>
                    </div>
                    <p style="color: #6b7280; font-size: 12px;">This code expires in <strong style="color: #ffffff;">15 minutes</strong>.</p>
                    <p style="color: #6b7280; font-size: 12px;">If you did not request this, you can safely ignore this email. Your account is safe.</p>
                </div>
            `
        });

        res.json({
            message: 'A 6-digit confirmation code has been sent to your email. It expires in 15 minutes.'
        });

    } catch (err) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error sending deletion confirmation'
        });
    }
});

// ========== DELETE /api/user/account/confirm ==========
// Step 2 of self-deletion: validates the 6-digit code and runs full cleanup.
// Saves tombstone, deletes everything, hard deletes user.
router.delete('/account/confirm', authenticateToken, async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.user.userId;

        if (!code) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_CODE',
                message: 'Confirmation code is required'
            });
        }

        // Find user with deletion fields selected
        const user = await User.findById(userId)
            .select('+accountDeletionCode +accountDeletionExpires');

        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        // Check code exists
        if (!user.accountDeletionCode || !user.accountDeletionExpires) {
            return res.status(400).json({
                status: 'error',
                code: 'NO_DELETION_REQUEST',
                message: 'No deletion request found. Please request a new code.'
            });
        }

        // Check expiry
        if (new Date() > user.accountDeletionExpires) {
            return res.status(400).json({
                status: 'error',
                code: 'CODE_EXPIRED',
                message: 'Confirmation code has expired. Please request a new one.'
            });
        }

        // Hash submitted code and compare
        const hashedSubmitted = crypto.createHash('sha256').update(code.trim()).digest('hex');
        if (hashedSubmitted !== user.accountDeletionCode) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_CODE',
                message: 'Incorrect confirmation code.'
            });
        }

        // ===== CODE VALID — RUN FULL CLEANUP =====

        // Save tombstone for audit trail
        try {
            await mongoose.connection.collection('deletedaccounts').insertOne({
                originalUserId: user._id,
                username: user.username,
                emailHash: crypto.createHash('sha256').update(user.email).digest('hex'),
                deletedAt: new Date(),
                deletedBy: 'self',
                statsSnapshot: user.stats,
                createdAt: user.createdAt,
                reason: 'User requested account deletion'
            });
        } catch (err) {
            // Non-fatal — continue with deletion even if tombstone fails
            console.error('Tombstone save failed:', err.message);
        }

        // Delete territories
        await Territory.deleteMany({ ownerId: userId });

        // Get activity IDs for social cleanup
        const userActivities = await Activity.find({ userId }).select('_id');
        const activityIds = userActivities.map(a => a._id);

        // Delete comments and kudos on their activities
        if (ActivityComment && activityIds.length > 0) {
            await ActivityComment.deleteMany({ activity: { $in: activityIds } });
        }
        if (ActivityKudos && activityIds.length > 0) {
            await ActivityKudos.deleteMany({ activity: { $in: activityIds } });
        }

        // Delete comments and kudos they left on other people's activities
        if (ActivityComment) await ActivityComment.deleteMany({ user: userId });
        if (ActivityKudos) await ActivityKudos.deleteMany({ user: userId });

        // Delete notifications
        if (Notification) await Notification.deleteMany({ user: userId });

        // Delete activities
        await Activity.deleteMany({ userId });

        // Remove from other users' followers/following lists
        await User.updateMany({ following: userId }, { $pull: { following: userId } });
        await User.updateMany({ followers: userId }, { $pull: { followers: userId } });

        // Hard delete the user
        await User.findByIdAndDelete(userId);

        res.json({
            message: 'Your account has been permanently deleted. We\'re sorry to see you go.'
        });

    } catch (err) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error deleting account'
        });
    }
});

// ========== GET /api/user/nearby-hexagons ==========
// Returns hex grid polygons around a given GPS coordinate.
// Used by mobile app to show uncaptured hexagons (gray grid).
// Backend does all h3-js math — mobile just renders polygons.
router.get('/nearby-hexagons', authenticateToken, async (req, res) => {
    try {
        const { latitude, longitude, rings } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_COORDINATES',
                message: 'latitude and longitude are required'
            });
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        const k = Math.min(parseInt(rings) || 4, 8); // Max 8 rings (~217 hexes)

        const { latLngToCell, gridDisk, cellToBoundary } = require('h3-js');
        const centerHex = latLngToCell(lat, lng, 10);
        const nearbyHexes = gridDisk(centerHex, k);

        const hexagons = nearbyHexes.map(hexId => {
            try {
                const boundary = cellToBoundary(hexId);
                return {
                    hexagonId: hexId,
                    polygon: boundary.map(([lat, lng]) => ({ latitude: lat, longitude: lng })),
                };
            } catch {
                return null;
            }
        }).filter(Boolean);

        res.json({
            message: 'Nearby hexagons retrieved',
            count: hexagons.length,
            hexagons
        });

    } catch (err) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error computing nearby hexagons'
        });
    }
});

// ========== GET /api/user/territories ==========
// Returns all captured territories globally so shields appear on the spinning globe
// regardless of the viewer's location. Capped at 5,000 to stay safe as the app
// scales — implement geospatial clustering when that limit is reached.
router.get('/territories', authenticateToken, async (req, res) => {
    try {
        const territories = await Territory.find({ ownerId: { $exists: true } })
            .limit(5000)
            .populate({ path: 'ownerId', match: { isActive: true }, select: 'username' })
            .select('hexagonId ownerId ownerActivityType capturedAt timesVisited')
            .lean();

        const formatted = territories
            .filter(t => t.ownerId !== null)
            .map(t => {
                let polygon = null;
                try {
                    const boundary = cellToBoundary(t.hexagonId);
                    polygon = boundary.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
                } catch (err) {
                    console.warn('Invalid H3 index:', t.hexagonId);
                }
                return {
                    hexagonId: t.hexagonId,
                    owner: { id: t.ownerId._id, username: t.ownerId.username },
                    activityType: t.ownerActivityType,
                    capturedAt: t.capturedAt,
                    captureCount: t.timesVisited ?? 1,
                    polygon
                };
            })
            .filter(t => t.polygon !== null);

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