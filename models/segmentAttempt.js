const mongoose = require('mongoose');

const segmentAttemptSchema = new mongoose.Schema({

    // References
    segmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Segment',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Performance Data
    time: {
        type: Number,
        required: true // seconds
    },
    distance: {
        type: Number,
        required: true // miles
    },
    elevationGain: {
        type: Number,
        default: 0
    },

    // Hexagon Data 
    coordinates: [{
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
    }],
    capturedHexagons: [{
        type: String // H3 cell IDs
    }],
    hexagonCount: {
        type: Number,
        default: 0
    },

    // Tracking
    isNewTerritoryMaster: {
        type: Boolean,
        default: false // Did this break the record?
    },
    previousTerritoryMaster: Number, // What they beat (if any)

    // Timestamps
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: Date
});

// Compound index for fast queries
segmentAttemptSchema.index({ segmentId: 1, createdAt: -1 });
segmentAttemptSchema.index({ userId: 1, segmentId: 1 });

module.exports = mongoose.model('SegmentAttempt', segmentAttemptSchema);