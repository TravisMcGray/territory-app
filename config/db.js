const mongoose = require('mongoose');

// Validate required environment variables at startup
const MONGODB_URI = process.env.MONGODB_URI;
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!MONGODB_URI) {
    console.error('FATAL ERROR: MONGODB_URI not set in .env file');
    process.exit(1);
}

const connectDB = async () => {
    try {
        const mongoOptions = {
            maxPoolSize: NODE_ENV === 'production' ? 50 : 10,
            minPoolSize: NODE_ENV === 'production' ? 10 : 5,
            socketTimeoutMS: 45000,
            serverSelectionTimeoutMS: 5000
        };

        await mongoose.connect(MONGODB_URI, mongoOptions);
        console.log('MongoDB connected');

        // Log connection events
        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected');
        });

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB error:', err.message);
        });
    } catch (err) {
        console.error('MongoDB connection failed:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;