const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
        },
        activityType: {
            type: String,
            enum: ['walk', 'run'],
            default: 'walk',
            required: true,
            index: true
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
        // Array of H3 hexagon IDs (resolution 10) captured during this activity
        // Used to track which territories were claimed/stolen in a single walk/run
            capturedHexagons: [{
            type: String
        }]
    },
{
    timestamps: true
});

// Index for efficient queries
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ userId: 1, activityType: 1, createdAt: -1 });


module.exports = mongoose.model('Activity', activitySchema);