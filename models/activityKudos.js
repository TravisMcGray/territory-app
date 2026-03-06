const mongoose = require('mongoose');

const activityKudosSchema = new mongoose.Schema({
    // ========== CORE REFERENCES ==========
    activity: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Activity',
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    
    // ========== TIMESTAMPS ==========
    // createdAt and updatedAt added automatically by Mongoose
    },
{
    timestamps: true
});

// ========== INDEXES FOR EFFICIENT QUERIES ==========
activityKudosSchema.index({ createdAt: -1 }); // Timestamp-based sorting

// Ensure one kudos per user per activity (prevent duplicates)
activityKudosSchema.index({ activity: 1, user: 1 }, { unique: true });

// Get all kudos for an activity
activityKudosSchema.index({ activity: 1, createdAt: -1 });

// Get all kudos by a user
activityKudosSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityKudos', activityKudosSchema);