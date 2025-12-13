const mongoose = require('mongoose');

const walkSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
        },
        activityType: {
            type: String,
            enum: ['walk', 'run'],
            default: 'walk'
        },
        coordinates: [{
            latitude: { type: Number, required: true },
            longitude: { type: Number, required: true },
            timestamp: Date
        }],
        distance: {
            type: Number,
            default: 0,
            min: 0
        },
            capturedHexagons: [{
            type: String
        }],
    },
{
    timestamps: true
});

// Index for efficient queries
walkSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Walk', walkSchema);