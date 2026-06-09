// ========== EXPRESS APP ==========
// Builds and configures the Express application without starting it or
// connecting to a database. This separation is what makes the app testable:
// tests can require('./app') and fire requests at it in memory, while the
// real database connection and listen() live in server.js.

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const authRouter = require('./routes/auth');
const activitiesRouter = require('./routes/activities');
const userRouter = require('./routes/user');
const leaderboardRouter = require('./routes/leaderboard');
const socialRouter = require('./routes/social');
const achievementsRouter = require('./routes/achievements');
const segmentsRouter = require('./routes/segments');
const routesRouter = require('./routes/routes');
const notificationsRouter = require('./routes/notifications');

const app = express();

// ========== SECURITY MIDDLEWARE ==========

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    next();
});

// Request logging. Writes to stdout, which Render captures automatically.
// Skipped during tests so the suite output stays clean. 'combined' in
// production gives IP, timestamp, status, response time, and user agent;
// 'dev' is a concise colored line for local development.
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Request size limits (prevent DoS)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(cookieParser());

// CORS
const allowedOrigins = [process.env.FRONTEND_URL].filter(Boolean);
if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push(
        'http://localhost:5173', // npm run dev
        'http://localhost:4173', // npm run preview (production build)
        'http://localhost:3000',
        'http://localhost:8081', // expo go
    );
}
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));

// Auth rate limiter: strict, for login/signup/verification
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    message: { status: 'error', code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: { status: 'error', code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ========== RATE LIMITERS (must be registered before routes) ==========
app.use('/api/auth', authLimiter);
// Password reset gets the strict auth limiter: prevents brute-force and email enumeration
app.use('/api/user/forgot-password', authLimiter);
app.use('/api/user/reset-password', authLimiter);
app.use('/api/user/account/delete-request', authLimiter);
app.use('/api/activities', apiLimiter);
app.use('/api/users', apiLimiter);
app.use('/api/user', apiLimiter);
app.use('/api/segments', apiLimiter);
app.use('/api/routes', apiLimiter);
app.use('/api/leaderboard', apiLimiter);
app.use('/api/achievements', apiLimiter);
app.use('/api/notifications', apiLimiter);

// ========== ROUTES ==========
app.use('/api/auth', authRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/user', userRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/users', socialRouter);
app.use('/api/achievements', achievementsRouter);
app.use('/api/segments', segmentsRouter);
app.use('/api/routes', routesRouter);
app.use('/api/notifications', notificationsRouter);

// ========== 404 HANDLER ==========
// Must come before the global error handler
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'Route not found'
    });
});

// ========== GLOBAL ERROR HANDLER ==========
// Must come last. Express identifies error handlers by the 4-param signature.
app.use((err, req, res, next) => {
    // Log the full stack server-side for debugging. The client still receives
    // only the safe, generic message below (never the stack in production).
    console.error(`Error on ${req.method} ${req.originalUrl}:`, err.stack || err.message);

    // Mongoose validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            status: 'error',
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: Object.keys(err.errors).reduce((acc, key) => {
                acc[key] = err.errors[key].message;
                return acc;
            }, {})
        });
    }

    // MongoDB duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(409).json({
            status: 'error',
            code: 'DUPLICATE_KEY',
            message: `${field} already exists`
        });
    }

    res.status(err.status || 500).json({
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'development'
            ? err.message
            : 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

module.exports = app;
