const jwt = require('jsonwebtoken');

// Validate JWT_SECRET exists and is strong
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET not set in .env file');
    console.error('Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
}

if (JWT_SECRET.length < 32) {
    console.error('FATAL ERROR: JWT_SECRET must be at least 32 characters');
    process.exit(1);
}

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            status: 'error',
            code: 'NO_TOKEN',
            message: 'Access token required'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            const statusCode = err.name === 'TokenExpiredError' ? 401 : 403;
            const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
            
            return res.status(statusCode).json({
                status: 'error',
                code,
                message: err.name === 'TokenExpiredError' 
                    ? 'Token expired. Please login again.' 
                    : 'Invalid token'
            });
        }

        req.user = user;
        next();
    });
};

module.exports = { authenticateToken, JWT_SECRET };