// ========== AUTH TEST HELPER ==========
// Creates a verified user directly in the database and returns a signed JWT
// for them. Tests that need to call a protected route can grab a token here
// instead of going through the full signup + verify + login flow every time.

const jwt = require('jsonwebtoken');
const User = require('../../models/user');

// overrides lets a test customize fields (email, username, weight, etc.).
const createUser = async (overrides = {}) => {
    const user = await User.create({
        email: 'auth-user@example.com',
        password: 'TestPass123',
        username: 'AuthUser',
        isEmailVerified: true,
        ...overrides,
    });

    // Same payload shape the login route signs: middleware/auth.js reads userId.
    const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    return { user, token };
};

module.exports = { createUser };
