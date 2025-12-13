const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { JWT_SECRET } = require('../middleware/auth');
const { validatePasswordStrength, validateEmailFormat } = require('../middleware/validation');

// POST /api/auth/signup
router.post('/signup', validateEmailFormat, validatePasswordStrength, async (req, res) => {
    try {
        const { email, password, username } = req.body;

        if (!username || username.length < 3 || username.length > 20) {
            return res.status(400).json({
                error: 'Username must be 3-20 characters'
            });
        }

        // Check if email already exists
        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Check if username already exists
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        // Create user (password hashed by pre-save middleware)
        const user = await User.create({
            email: email.toLowerCase(),
            password,
            username
        });

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User created successfully',
            token,
            userId: user._id
        });
    } catch (error) {
        res.status(400).json({
            message: 'Error creating user',
            error: error.message
        });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        // Find user and explicitly select password (hidden by default)
        const user = await User.findByEmail(email).select('+password');

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
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
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;