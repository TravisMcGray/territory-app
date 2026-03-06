const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({

    // Basic Info
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        index: true
    },
    description: { type: String, trim: true, maxlength: 500 },

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
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        username: String,
        time: Number,
        heldSince: Date
    },

    // Stats 
    totalAttempts: {
        type: Number,
        default: 0,
        min: 0
    },
    totalUniqueAttempts: {
        type: Number,
        default: 0,
        min: 0
    }
},
{
    timestamps: true
});

    segmentSchema.index({ createdAt: -1 });
    segmentSchema.index({ creator: 1, createdAt: -1 }); // Creator's segments
    segmentSchema.index({ 'territoryMaster.userId': 1 }); // Territory master lookups

module.exports = mongoose.model('Segment', segmentSchema);