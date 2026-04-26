const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    // ========== AUTHENTICATION ==========
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

    // ========== EMAIL VERIFICATION ==========
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: {
        type: String,
        select: false // Never return in queries
    },
    emailVerificationExpires: {
        type: Date,
        select: false
    },

    // ========== PASSWORD RESET ==========
    // Hashed token stored here — raw token only travels in email, never stored
    passwordResetToken: {
        type: String,
        select: false
    },
    passwordResetExpires: {
        type: Date,
        select: false
    },

    // ========== ACCOUNT DELETION ==========
    // 6-digit code hashed before storage — expires in 15 minutes
    accountDeletionCode: {
        type: String,
        select: false
    },
    accountDeletionExpires: {
        type: Date,
        select: false
    },

    // ========== PROFILE ==========
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 20,
        match: [/^[a-zA-Z][a-zA-Z0-9]{2,19}$/, 'Username must start with a letter and contain only letters and numbers']
    },
    firstName:   { type: String, trim: true, maxlength: 50 },
    lastName:    { type: String, trim: true, maxlength: 50 },
    avatar:      { type: String, maxlength: 500 },
    weight:      { type: Number, min: 50, max: 1000, default: 154 }, // lbs — used for calorie calculation
    age:         { type: Number, min: 13, max: 120 },
    sex:         { type: String, enum: ['male', 'female', 'prefer_not_to_say'] },
    heightFeet:  { type: Number, min: 3, max: 8 },
    heightInches:{ type: Number, min: 0, max: 11 },
    stepLength:  { type: Number, min: 10, max: 50 }, // inches — auto-calculated from height if not set

    // ========== GAME STATS ==========
    stats: {
        totalWalks:             { type: Number, default: 0, min: 0 },
        totalRuns:              { type: Number, default: 0, min: 0 },
        totalDistance:          { type: Number, default: 0, min: 0 }, // miles
        totalHexagonsCaptured:  { type: Number, default: 0, min: 0 },
        totalStolenTerritories: { type: Number, default: 0, min: 0 }
    },

    // ========== SOCIAL ==========
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // ========== ACHIEVEMENTS ==========
    achievements: [
        {
            achievementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Achievement' },
            unlockedAt:    { type: Date, default: Date.now }
        }
    ],

    // ========== PRIVACY ==========
    activityPrivacy: {
        type: String,
        enum: ['public', 'followers', 'private'],
        default: 'followers'
    },

    // ========== ACCOUNT METADATA ==========
    usernameChangedAt: Date,
    lastLogin:         Date,
    isActive:          { type: Boolean, default: true, select: false }

}, { timestamps: true });

// ========== INDEXES ==========
userSchema.index({ 'stats.totalHexagonsCaptured': -1 }); // Leaderboards
userSchema.index({ followers: 1 });
userSchema.index({ following: 1 });
userSchema.index({ emailVerificationToken: 1 }); // Verification lookups

// ========== INSTANCE METHODS ==========

userSchema.methods.canChangeUsername = function () {
    return this.stats.totalHexagonsCaptured >= 100;
};

userSchema.methods.isFollowing = function (userId) {
    if (!this.following) return false;
    return this.following.some(id => id.toString() === userId.toString());
};

userSchema.methods.getFollowerCount = function () {
    return this.followers ? this.followers.length : 0;
};

userSchema.methods.getFollowingCount = function () {
    return this.following ? this.following.length : 0;
};

// Own profile — includes private fields
userSchema.methods.toProfileJSON = function () {
    return {
        id:                this._id,
        email:             this.email,
        username:          this.username,
        firstName:         this.firstName,
        lastName:          this.lastName,
        avatar:            this.avatar,
        weight:            this.weight,
        age:               this.age,
        sex:               this.sex,
        heightFeet:        this.heightFeet,
        heightInches:      this.heightInches,
        stepLength:        this.stepLength,
        isEmailVerified:   this.isEmailVerified,
        stats:             this.stats,
        followers:         this.followers ? this.followers.length : 0,
        following:         this.following ? this.following.length : 0,
        canChangeUsername: this.canChangeUsername(),
        activityPrivacy:   this.activityPrivacy,
        createdAt:         this.createdAt,
        lastLogin:         this.lastLogin
    };
};

// Public profile — what other users see (no email, no weight, no verification status)
userSchema.methods.toPublicJSON = function () {
    return {
        id:        this._id,
        username:  this.username,
        firstName: this.firstName,
        lastName:  this.lastName,
        avatar:    this.avatar,
        stats:     this.stats,
        followers:       this.followers ? this.followers.length : 0,
        following:       this.following ? this.following.length : 0,
        activityPrivacy: this.activityPrivacy,
        createdAt:       this.createdAt
    };
};

// ========== STATIC METHODS ==========

userSchema.statics.findByEmail = function (email, selectPassword = false) {
    const query = this.findOne({ email: email.toLowerCase() });
    if (selectPassword) query.select('+password');
    return query;
};

// ========== MIDDLEWARE ==========

// Hash password before save (only if modified)
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        this.password = await bcrypt.hash(this.password, 12);
        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model('User', userSchema);