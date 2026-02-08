const mongoose = require('mongoose');
const route = require('./route');

const routeAttemptSchema = new mongoose.Schema({
    // ========== CORE REFERENCES ==========
    route: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Route',
        required: true,
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // Link to the activity that completed this route
    activity: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Activity',
        required: true,
    },

    // ========== PERFORMANCE DATA ==========
    // Time taken to complete route (in seconds)
    completionTime: {
        type: Number,
        required: true,
        min: 0
    },

    // ========== COMPLETION STATUS ==========
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// ========== INDEXES FFOR LEADERBOARDS AND QUERIES ==========
routeAttemptSchema.index({ route: 1, completionTime: 1 }); // For leaderboards (fastest first)
routeAttemptSchema.index({ user: 1, createdAt: -1 }); // User's attempts sorted by most recent
routeAttemptSchema.index({ route: 1, user: 1 }); // User's attempts on specific route
routeAttemptSchema.index({ route: 1, completed: 1, completionTime: 1 }); // Fast Leaderboard queries

module.exports = mongoose.model('RouteAttempt', routeAttemptSchema);