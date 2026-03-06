const mongoose = require('mongoose');

const segmentAttemptSchema = new mongoose.Schema({

    // References
    segmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Segment',
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    // Performance Data
    time: {
        type: Number,
        required: true, // seconds
        min: 1
    },
    distance: {
        type: Number,
        required: true, // miles
        min: 0
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
        default: 0,
        min: 0
    },

    // Tracking
    isNewTerritoryMaster: {
        type: Boolean,
        default: false // Did this break the record?
    },
    previousTerritoryMaster: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

},
{
    timestamps: true
});

// Compound index for fast queries
segmentAttemptSchema.index({ createdAt: -1 });
segmentAttemptSchema.index({ segmentId: 1, createdAt: -1 });
segmentAttemptSchema.index({ userId: 1, segmentId: 1 });

module.exports = mongoose.model('SegmentAttempt', segmentAttemptSchema);