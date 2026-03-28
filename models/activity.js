const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        },
        activityType: {
            type: String,
            enum: ['walk', 'run'],
            default: 'walk',
            required: true,
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
        // Fields for Strava partity
        // Duration in seconds (required)
        duration: {
            type: Number,
            required: true,
            min: 1
        },
        // Elevation gain in meters and feet
        elevationGain: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        },

        // Array of H3 hexagon IDs (resolution 10) captured during this activity
        // Used to track which territories were claimed/stolen in a single walk/run
            capturedHexagons: [{
            type: String
        }],
        stolenHexagons: {
            type: Number,
            default: 0,
            min: 0
        },
        estimatedCalories: {
            type: Number,
            default: 0,
            min: 0
        },
    },
{
    timestamps: true
});

// Index for efficient queries
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ userId: 1, activityType: 1, createdAt: -1 });

// Virtual fields (calculated, not stored)
// Calculated pace: minutes per mile
activitySchema.virtual('pace').get(function() {
    if (this.distance === 0) return 0;
    const minutes = this.duration / 60;
    return parseFloat((minutes / this.distance).toFixed(2));
});

// Calculate average speed: miles per hour
activitySchema.virtual('averageSpeed').get(function() {
    if (this.duration === 0) return 0;
    const hours = this.duration / 3600;
    return parseFloat((this.distance / hours).toFixed(2));
});

// estimatedCalories is now stored as a real field (calculated at creation time
// using the user's body stats). This virtual is kept as a fallback only for
// old activities that don't have the field set.
activitySchema.virtual('caloriesFallback').get(function() {
    if (this.estimatedCalories > 0) return this.estimatedCalories;
    const caloriesPerMile = this.activityType === 'run' ? 100 : 50;
    return Math.round(this.distance * caloriesPerMile);
});

// Include virtuals when converting to json
activitySchema.set('toJSON', { virtuals: true });
activitySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Activity', activitySchema);