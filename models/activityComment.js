const mongoose = require('mongoose');

const activityCommentSchema = new mongoose.Schema({
    // ========== CORE REFERENCES ==========
    activity: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Activity',
        required: true,
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    // ========== COMMENT CONTENT ==========
    text: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 500
    },
    
    // ========== TIMESTAMPS ==========
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// ========== INDEXES FOR EFFICIENT QUERIES ==========
// Get all comments for an activity (sorted by time)
activityCommentSchema.index({ activity: 1, createdAt: 1 });

// Get all comments by a user
activityCommentSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityComment', activityCommentSchema);