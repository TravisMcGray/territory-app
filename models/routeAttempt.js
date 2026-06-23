const mongoose = require('mongoose');

const routeAttemptSchema = new mongoose.Schema({
    // ========== CORE REFERENCES ==========
    route: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Route',
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
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
        min: 1 // Minimum 1 second, since a zero completion time is not valid
    },

    // ========== TIMESTAMPS ==========
    // createdAt and updatedAt added automatically by Mongoose
},
{
    timestamps: true
});

// ========== INDEXES FOR LEADERBOARDS AND QUERIES ==========
routeAttemptSchema.index({ createdAt: -1 }); // Timestamp-based sorting
routeAttemptSchema.index({ route: 1, completionTime: 1 }); // Leaderboards: fastest completions per route
routeAttemptSchema.index({ user: 1, createdAt: -1 }); // User's attempts sorted by most recent
routeAttemptSchema.index({ route: 1, user: 1 }); // User's attempts on a specific route

module.exports = mongoose.model('RouteAttempt', routeAttemptSchema);