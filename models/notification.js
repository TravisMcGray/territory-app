const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    // ========== CORE REFERENCES ==========
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
        // No standalone index needed — covered by compound indexes below
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
            'KUDOS',
            'SYSTEM'    // Admin/moderator system messages e.g. username resets
        ],
        required: true
        // No standalone index needed — covered by compound indexes below
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    message: {
        type: String,
        required: true,
        trim: true,
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

    // ========== READ STATUS ==========
    read: {
        type: Boolean,
        default: false
        // No standalone index needed — covered by compound indexes below
    },

    // ========== TTL: Auto-delete READ notifications after 30 days ==========
    // expiresAt is set by the route when a notification is marked as read
    // Unread notifications are never deleted automatically
    expiresAt: {
        type: Date,
        default: null,
        index: { expireAfterSeconds: 0 } // MongoDB deletes doc when expiresAt date is reached
    }

},
{
    timestamps: true // createdAt and updatedAt added automatically by Mongoose
});

// ========== INDEXES FOR EFFICIENT QUERIES ==========
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);