const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
    // Achievement name and description
    name: {
        type: String,
        required: true,
        unique:  true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true, // Strips leading/trailing whitespace
        maxlength: 500
    },

    // Achievement type/category
    category: {
        type: String,
        required: true,
        enum: ['TERRITORY', 'SOCIAL', 'DISTANCE', 'ACTIVITY', 'EXPLORATION', 'CONSISTENCY'],
        // No standalone index needed — covered by compound index below
    },
    // Which activity type this achievement is for
    activityType: {
        type: String,
        enum: ['WALK', 'RUN', 'UNIVERSAL'],
        default: 'UNIVERSAL',
        // No standalone index needed — covered by compound index below
    },

    // What triggers this achievement
    condition: {
        field: {
            type: String,
            required: true
            // Examples: 'stats.totalWalks/Runs', 'stats.totalDistance', 'stats.totalHexagonsCaptured', 'followers'
        },
        operator: {
            type: String,
            required: true,
            enum: ['>=', '<=', '==', '>', '<']
        },
        value: {
            type: Number,
            required: true
        }
    },

    // Badge/icon URL
    badgeUrl: { type: String, maxlength: 500 }, 

    // rarity tier
    rarity: {
        type: String,
        enum: ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'],
        default: 'COMMON',
    },

    // Optional gamification
    points: {
        type: Number,
        default: 10,
        min: 0 // Points cannot be negative
    }
},
{ 
    timestamps: true 
});

// ========== INDEXES FOR EFFICIENT QUERIES ==========
achievementSchema.index({ category: 1, activityType: 1 }); // Filter achievements by category and activity type
achievementSchema.index({ rarity: 1 }); // Filter by rarity tier

module.exports = mongoose.model('Achievement', achievementSchema);