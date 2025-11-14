const mongoose = require('mongoose');

const territorySchema = new mongoose.Schema({
    hexagonId: {
        type: String,
        required: true,
        unique: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    capturedAt: {
        type: Date,
        default: Date.now
    },
    timesVisited: {
        type: Number,
        default: 1
    }
});

module.exports = mongoose.model('Territory', territorySchema);