const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    // ========== CORE REFERENCES ==========
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // ========== NOTIFICATION CONTENT ==========
    type: {
        type: String,
        enum: [
            'ACHIEVEMENT',
            'FRIEND_ACTIVITY',
            'TERRITORY_STOLEN',
            'SEGMENT_RECORD',
            'NEW_FOLLOWER',
            'COMMENT',
            'KUDOS'
        ],
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        maxlength: 100
    },
    message: {
        type: String,
        required: true,
        maxlength: 500
    },

    // ========== RELATED ENTITIES (Optional - depends on type) ==========
    relatedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    relatedActivity: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Activity'
    },
    relatedAchievement: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Achievement'
    },
    relatedSegment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Segment'
    },

    // ========== READ STATUS & TIMESTAMPS ==========
    read: {
        type: Boolean,
        default: false,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// ========== INDEXES FOR EFFICIENT QUERIES ==========
notificationSchema.index({ user: 1, read: 1, createdAt: -1 }); // User's notifications timeline
notificationSchema.index({ user: 1, read: 1 }); // Unread count queries
notificationSchema.index({ user: 1, type: 1 }); // Filter by type

// Auto-delete old read notifications after 30 days (Optional - keeps DB clean)
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days in seconds

module.exports = mongoose.model('Notification', notificationSchema);