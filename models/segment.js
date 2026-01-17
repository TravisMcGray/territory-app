const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({

    // Basic Info
    name: {
        type: String,
        required: true,
        index: true
    },
    description: String,

    // Route Data
    coordinates: [{
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
    }],

    // Metadata
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },

    // Territory Master (Current Fastest)
    territoryMaster: {
        userId: mongoose.Schema.Types.ObjectId,
        username: String,
        time: Number, // seconds
        heldSince: Date
    },

    // Stats 
    totalAttempts: {
        type: Number,
        default: 0
    },
    totalUniqueAttempts: {
        type: Number,
        default: 0
    },

    // Timestamps
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: Date
});

module.exports = mongoose.model('Segment', segmentSchema);