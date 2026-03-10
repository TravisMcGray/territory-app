const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
// Authentication
email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    password: {
        type: String,
        required: true,
        minlength: 8,
        select: false // Never return password in queries
    },

// Profile
username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: [/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Username must start with letter, contain only alphanumeric and underscore']
    },
    firstName: { type: String, trim: true, maxlength: 50 },
    lastName: { type: String, trim: true, maxlength: 50 },
    avatar: { type: String, maxlength: 500 },
    weight: { type: Number, min: 50, max: 1000, default: 154 }, // lbs — used for calorie calculation, defaults to 154

// Game stats (updated atomically with walks/runs)
stats: {
    totalWalks: { type: Number, default: 0, min: 0 },
    totalRuns: { type: Number, default: 0, min: 0 },
    totalDistance: { type: Number, default: 0, min: 0 }, // miles
    totalHexagonsCaptured: { type: Number, default: 0, min: 0 },
    totalStolenTerritories: { type: Number, default: 0, min: 0 } // Cumulative hexagons stolen from other players
    },

// Social features
following: [
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
],
followers: [
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
],
achievements: [
    {
        achievementId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Achievement'
        },
        unlockedAt: {
            type: Date,
            default: Date.now
        }
    }
],
    
    // Account metadata
    usernameChangedAt: Date,
    lastLogin: Date,
    isActive: { type: Boolean, default: true, select: false }
    },
    {
        timestamps: true // Adds createdAt and updatedAt automatically
    }
);

// Indexes for performance
userSchema.index({ 'stats.totalHexagonsCaptured': -1 }); // For leaderboards
userSchema.index({ followers: 1 }); // For finding who follows a user
userSchema.index({ following: 1 }); // For finding who a user follows


// Instance methods
userSchema.methods.canChangeUsername = function() {
    return this.stats.totalHexagonsCaptured >= 100;
};

// Check if user is following another user
userSchema.methods.isFollowing = function(userId) {
    if (!this.following) return false;
    return this.following.some(id => id.toString() === userId.toString());
};

// Get follower count
userSchema.methods.getFollowerCount = function() {
    return this.followers.length;
};

// Get following count
userSchema.methods.getFollowingCount = function() {
    return this.following.length;
};

userSchema.methods.toProfileJSON = function() {
    return {
        id: this._id,
        email: this.email,
        username: this.username,
        firstName: this.firstName,
        lastName: this.lastName,
        avatar: this.avatar,
        weight: this.weight, // User's weight in lbs — used for calorie calculations
        stats: this.stats,
        followers: this.followers ? this.followers.length : 0,
        following: this.following ? this.following.length : 0,
        canChangeUsername: this.canChangeUsername(),
        createdAt: this.createdAt,
        lastLogin: this.lastLogin
    };
};

// Get public profile (what others see)
userSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        username: this.username,
        firstName: this.firstName,
        lastName: this.lastName,
        avatar: this.avatar,
        stats: this.stats,
        followers: this.followers ? this.followers.length : 0,
        following: this.following ? this.following.length : 0,
        createdAt: this.createdAt
    };
};

// Static methods
userSchema.statics.findByEmail = function(email, selectPassword = false) {
    const query = this.findOne({ email: email.toLowerCase() });
    if (selectPassword) query.select('+password');
    return query;
};

// Middleware: Hash password before save (only if modified)
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        this.password = await bcrypt.hash(this.password, 12);
        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model('User', userSchema);