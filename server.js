require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
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
const PORT = process.env.PORT || 3000;

// ========== SECURITY MIDDLEWARE ==========

// Request size limits (prevent DoS)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// CORS
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
}));

// Rate limiting for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 5 requests per window
    message: 'Too many login attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// ========== DATABASE ==========
connectDB();

// ========== ROUTES ==========

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Route registration with rate limiters
app.use('/api/auth', authLimiter);
app.use('/api/activities', apiLimiter);
app.use('/api/users', apiLimiter);
app.use('/api/user', apiLimiter);
app.use('/api/segments', apiLimiter);
app.use('/api/routes', apiLimiter);


app.use('/api/auth', authRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/user', userRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/users', socialRouter);
app.use('/api/achievements', achievementsRouter);
app.use('/api/segments', segmentsRouter);
app.use('/api/routes', routesRouter);
app.use('/api/notifications', notificationsRouter);

// ========== GLOBAL ERROR HANDLER ==========
app.use((err, req, res, next) => {
    console.error('Error:', err.message);

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

    // MongoDB duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(409).json({
            status: 'error',
            code: 'DUPLICATE_KEY',
            message: `${field} already exists`
        });
    }

    // Default error
    res.status(err.status || 500).json({
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' 
            ? err.message 
            : 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ========== 404 HANDLER ==========
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'Route not found'
    });
});

// ========== START ==========
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});