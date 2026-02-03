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
        required: true
    },

    // Achievement type/category
    category: {
        type: String,
        required: true,
        enum: ['TERRITORY', 'SOCIAL', 'DISTANCE', 'ACTIVITY', 'EXPLORATION', 'CONSISTENCY'],
        index: true
    },
    // Which activity type this achievement is for
    activityType: {
        type: String,
        enum: ['WALK', 'RUN', 'UNIVERSAL'],
        default: 'UNIVERSAL',
        index: true
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

    // Badge/icon URL (TODO: images added later)
    badgeUrl: String,

    // rarity tier
    rarity: {
        type: String,
        enum: ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'],
        default: 'COMMON',
    },

    // Optional gamification
    points: {
        type: Number,
        default: 10
    }
},
{ 
    timestamps: true 
});

module.exports = mongoose.model('Achievement', achievementSchema);