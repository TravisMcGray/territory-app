const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { JWT_SECRET } = require('../middleware/auth');
const { validatePasswordStrength, validateEmailFormat } = require('../middleware/validation');
const { validateUsername } = require('../middleware/profanity');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// ========== HELPERS ==========

// Generate a secure random token and return both the raw value (for email)
// and the hashed value (for DB storage — never store raw tokens)
const generateVerificationToken = () => {
    const raw = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(raw).digest('hex');
    return { raw, hashed };
};

const sendVerificationEmail = async (email, username, rawToken) => {
    const verifyUrl = `${process.env.BACKEND_URL}/api/auth/verify-email?token=${rawToken}`;
    await resend.emails.send({
        from: 'TerritoryCapture <onboarding@resend.dev>',
        to: email,
        subject: 'Verify your TerritoryCapture email',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #030712; color: #ffffff; padding: 32px; border-radius: 16px;">
                <h2 style="color: #10b981; margin-bottom: 8px;">TerritoryCapture</h2>
                <h3 style="color: #ffffff; margin-bottom: 16px;">Verify your email address</h3>
                <p style="color: #9ca3af;">Hi ${username},</p>
                <p style="color: #9ca3af;">Thanks for signing up! Click the button below to verify your email and start capturing territory.</p>
                <p style="color: #9ca3af;">This link expires in <strong style="color: #ffffff;">24 hours</strong>.</p>
                <a href="${verifyUrl}"
                    style="display: inline-block; background: #10b981; color: white;
                            padding: 12px 24px; border-radius: 8px; text-decoration: none;
                            font-weight: bold; margin: 16px 0;">
                    Verify Email
                </a>
                <p style="color: #6b7280; font-size: 12px;">If you didn't create an account, you can safely ignore this email.</p>
                <p style="color: #6b7280; font-size: 12px;">If the button doesn't work, copy and paste this link:<br>${verifyUrl}</p>
            </div>
        `
    });
};

// ========== POST /api/auth/signup ==========
router.post('/signup', validateEmailFormat, validatePasswordStrength, async (req, res) => {
    try {
        const { email, password, username } = req.body;

        // Validate username format + profanity check
        const usernameCheck = validateUsername(username);
        if (!usernameCheck.valid) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_USERNAME',
                message: usernameCheck.message
            });
        }

        // Check for existing email
        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            return res.status(409).json({
                status: 'error',
                code: 'EMAIL_IN_USE',
                message: 'Email already registered'
            });
        }

        // Check for existing username
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(409).json({
                status: 'error',
                code: 'USERNAME_TAKEN',
                message: 'Username already taken'
            });
        }

        // Generate verification token
        const { raw, hashed } = generateVerificationToken();

        // Create user — NOT verified yet, NO login token issued
        await User.create({
            email: email.toLowerCase(),
            password,
            username,
            isEmailVerified: false,
            emailVerificationToken: hashed,
            emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });

        // Send verification email
        await sendVerificationEmail(email.toLowerCase(), username, raw);

        // Return success — no token, user must verify first
        res.status(201).json({
            message: 'Account created! Please check your email to verify your account before logging in.',
            requiresVerification: true
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error creating user'
        });
    }
});

// ========== POST /api/auth/login ==========
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_FIELDS',
                message: 'Email and password are required'
            });
        }

        // Find user + select password for comparison
        const user = await User.findByEmail(email, true);

        // Intentionally vague — don't reveal whether email exists
        if (!user) {
            return res.status(401).json({
                status: 'error',
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password'
            });
        }

        // Block soft-deleted accounts
        // Need to explicitly select isActive since it has select: false
        const userWithActive = await User.findById(user._id).select('+isActive');
        if (userWithActive.isActive === false) {
            return res.status(403).json({
                status: 'error',
                code: 'ACCOUNT_DEACTIVATED',
                message: 'This account has been deactivated'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                status: 'error',
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password'
            });
        }

        // Block unverified accounts
        if (!user.isEmailVerified) {
            return res.status(403).json({
                status: 'error',
                code: 'EMAIL_NOT_VERIFIED',
                message: 'Please verify your email before logging in. Check your inbox or request a new verification email.'
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Issue JWT
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            userId: user._id
        });

    } catch (err) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error logging in'
        });
    }
});

// ========== GET /api/auth/verify-email ==========
// Called when user clicks the link in their email.
// Validates token, marks account verified, redirects to frontend.
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?verified=invalid`);
        }

        // Hash the raw token to compare against stored hash
        const hashed = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            emailVerificationToken: hashed,
            emailVerificationExpires: { $gt: new Date() }
        }).select('+emailVerificationToken +emailVerificationExpires');

        if (!user) {
            // Token not found or expired
            return res.redirect(`${process.env.FRONTEND_URL}/login?verified=invalid`);
        }

        // Mark verified and clear token fields
        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        // Redirect to login with success flag
        return res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);

    } catch (err) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?verified=error`);
    }
});

// ========== POST /api/auth/resend-verification ==========
// For users who lost or never received their verification email.
router.post('/resend-verification', validateEmailFormat, async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findByEmail(email)
            .select('+emailVerificationToken +emailVerificationExpires');

        // Always return same message — don't reveal if email exists
        const genericResponse = {
            message: 'If an unverified account exists with this email, a new verification link has been sent.'
        };

        if (!user) return res.json(genericResponse);
        if (user.isEmailVerified) return res.json(genericResponse);

        // Generate fresh token
        const { raw, hashed } = generateVerificationToken();
        user.emailVerificationToken = hashed;
        user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await user.save();

        await sendVerificationEmail(user.email, user.username, raw);

        res.json(genericResponse);

    } catch (err) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error resending verification email'
        });
    }
});

module.exports = router;