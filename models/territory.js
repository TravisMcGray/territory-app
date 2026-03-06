const mongoose = require('mongoose');

const territorySchema = new mongoose.Schema({

    hexagonId: {
        type: String,
        required: true,
        unique: true,
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    //  Track who owned it BEFORE we change it (for race condition detection)
    previousOwnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Track what activity type currently owns this (WALK or RUN)
    // Used to enforce stealing rules: Runners can steal from runners, walkers cannot steal
    ownerActivityType: {
        type: String,
        enum: ['WALK', 'RUN'],
        required: true
    },
    // Track which activity originally claimed this territory (for deletion reversal)
    capturedByActivityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Activity'
    },
    capturedAt: {
        type: Date,
        default: Date.now
    },
    timesVisited: {
        type: Number,
        default: 1,
        min: 1
    }
},
{
    timestamps: true
});

// Index for leaderboard queries
territorySchema.index({ ownerId: 1, hexagonId: 1 });

// Index for activity deletion queries (find all territories claimed by this activity)
territorySchema.index({ capturedByActivityId: 1 });

module.exports = mongoose.model('Territory', territorySchema);