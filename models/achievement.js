const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
    // Achievement name and description
    name: {
        type: String,
        required: true,
        uneiqu:  true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },

    // Achievement type/category
    type: {
        type: String,
        required: true,
        enum: ['WALK', 'RUN', 'TERRITORY', 'SOCIAL', 'DISTANCE', 'ACTIVITY'],
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