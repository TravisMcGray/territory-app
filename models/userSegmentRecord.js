const mongoose = require('mongoose');

const userSegmentRecordSchema = new mongoose.Schema({
    
    // References
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    segmentId: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Segment',
        required: true,
        index: true
    },

    // Performance
    personalBest: {
        type: Number,
        required: true // seconds (their fastest time)
    },
    attempts: {
        type: Number,
        default: 1 // How many times they've completed this segment
    },

    // Territory Strength (for hexagon Coloring)
    territoryStrength: {
        type: Number,
        default: 1, // 1-10 scale (determines white/yellow/gold/red)
        min: 1,
        max: 10
    },

    // Hexagons
    totalHexagonsCaptured: {
        type: Number,
        default: 0 // Cumulative from all attempts
    },

    // Territory Master Status
    holdsTerritoryMaster: {
        type: Boolean,
        default: false
    },
    territoryMasterSince: Date,

    // Timestamps
    lastAttempt: Date,
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: Date
});

// Compound indexes for efficient queries
userSegmentRecordSchema.index({ userId: 1, segmentId: 1 });
userSegmentRecordSchema.index({ segmentId: 1, personalBest: 1 });
userSegmentRecordSchema.index({ holdsTerritoryMaster: 1, segmentId: 1 });

module.exports = mongoose.model('UserSegmentRecord', userSegmentRecordSchema);