// Validation functions
const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

const validatePassword = (password) => {
    // Min 8 chars, 1 uppercase, 1 lowercase, 1 number
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return regex.test(password);
};

const validateUsername = (username) => {
    // 3-20 chars, starts with letter, alphanumeric + underscore
    const regex = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;
    return regex.test(username);
};

// Middleware functions
const validatePasswordStrength = (req, res, next) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({
            error: 'Password is required',
            requirements: 'Min 8 characters, 1 uppercase, 1 lowercase, 1 number'
        });
    }

    if (!validatePassword(password)) {
        return res.status(400).json({
            error: 'Password does not meet requirements',
            requirements: 'Min 8 characters, 1 uppercase, 1 lowercase, 1 number'
        });
    }

    next();
};

const validateEmailFormat = (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    if (!validateEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' }); // Fixed: was 4004
    }

    next();
};

const validateUsernameFormat = (req, res, next) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' }); // Fixed: was 404
    }

    if (!validateUsername(username)) {
        return res.status(400).json({ error: 'Invalid username', requirements: '3-20 characters, alphanumeric + underscore, start with letter' }); // Fixed: was 404
    }

    next();
};

module.exports = {
    validatePasswordStrength,
    validateEmailFormat,
    validateUsernameFormat,
    validateEmail,
    validatePassword,
    validateUsername
};