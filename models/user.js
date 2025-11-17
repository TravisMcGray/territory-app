const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    // This is where we authenticate users
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },

    // Profile information
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 20
    },
    firstname: {
        type: String,
        default: ''
    },
    lastname: {
        type: String,
        default: ''
    },
    avatar: {
        type: String,
        default: null
    },

    // Denormalized stats (updated when walk is created)
    totalWalks: {
        type: Number,
        default: 0
    },
    totalDistance: {
        type: Number,
        default: 0
    },
    totalHexagonscaptured: {
        type: Number,
        default: 0
    },

    // Username change history
    usernameChangedAt: {
        type: Date,
        default: null
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: null
    }
});

// Method to check if username can be user can be changed
userSchema.methods.canChangeUsername = function() {
    return this.totalHexagonsCaptured >= 100;
};

// Method to get user profile (exclude sensitive fields)
userSchema.methods.getProfile = function() {
    return {
        _id: this._id,
        email: this.email,
        username: this.username,
        firstname: this.fistname,
        lastname: this.lastname,
        avatar: this.avatar,
        totalWalks: this.totalWalks,
        totalDistance: this.totalDistance,
        totalHexagonsCaptured: this.totalhexagonsCaptured,
        canChangeUsername: this.canChangeUsername(),
        createdAt: this.createdAt
    };
};

module.exports = mongoose.model('User', userSchema);