const mongoose = require('mongoose');

const territorySchema = new mongoose.Schema({

    hexagonId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
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

module.exports = mongoose.model('Territory', territorySchema);