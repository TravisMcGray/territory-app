const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/territory-app');
        console.log('Connected to MongoDB');
    } catch (err) {
        console.log('MongoDB connection error:', err);
        process.exit(1);
    }
};

module.exports = connectDB;