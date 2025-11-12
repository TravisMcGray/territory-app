const mongoose = require('mongoose');

const walkSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    coordinates: [{
        latitude: Number,
        longitude: Number,
        timestamp: Date
    }],
    distance: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Walk', walkSchema);