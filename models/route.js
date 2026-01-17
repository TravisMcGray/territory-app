const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({

    // Basic info
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
        index: true
    },

    // Stats
    totalCompletions: {
        type: Number,
        default: 0
    },
    uniqueCompleters: {
        type: Number,
        default: 0
    },
    averageTime: {
        type: Number,
        default: 0
    },

    // Route Performance
    distance: Number, // miles
    estimatedTime: Number, // seconds (creator's estimate or average)

    // Timestamps
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: Date
});

// Index for efficient queries
routeSchema.index({ creator: 1, createdAt: -1 });

module.exports = mongoose.model('Route', routeSchema);