const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
    // ========== BASIC INFO ==========
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        index: true
    },
    description: {
        type: String,
        maxlength: 500
    },

    // ========== ROUTE PATH INFO ==========
    // GPS waypoints that define the route (ordered path)
    coordinates: [{
        latitude: {
            type: Number,
            required: true,
            min: -90,
            max: 90
        },
        longitude: {
            type: Number,
            required: true,
            min: -180,
            max: 180
        }
    }],

    // ========== ROUTE CHARACTERISTICS ==========
    distance: {
        type: Number, // miles
        required: true,
    },
    elevationGain: {
        type: Number, // meters
        default: 0
    },
    difficulty: {
        type: String,
        enum: ['EASY', 'MODERATE', 'HARD', 'EXPERT'],
        default: 'MODERATE'
    },

    // ========== DISCOVERY & CATEGORIZATION ==========
    tags: [{
        type: String,
        enum: [
            'SCENIC',
            'URBAN',
            'TRAIL',
            'HILLS',
            'FLAT',
            'LOOP',
            'OUT_AND_BACK',
            'BEGINNER_FRIENDLY',
            'CHALLENGING',
            'WATERFRONT',
            'PARK'
        ]
    }],

    // Privacy setting
    isPublic: {
        type: Boolean,
        default: true
    },

    // ========== CREATOR INFO ==========
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // ========== STATISTICS (Updated by route handlesd when attempts are recorded) ==========
    totalCompletions: {
        type: Number,
        default: 0
    },
    uniqueCompletions: {
        type: Number,
        default: 0
    },
    averageTime: {
        type: Number, // seconds
        default: 0
    },
    fastestCompletionTime: {
        type: Number, // seconds
        default: 0
    },
    estimatedTime: {
        type: Number, //seconds (creator's estimate for expected completion time)
        default: null
    },

    // ========== GEOSPATIAL SEARCH ==========
    // Start location for "routes near me" queries
    startLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            index: '2dsphere'
        }
    },

    // ========== TIMESTAMPS ==========
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: Date
});

// ========== INDEXES FOR EFFICIENT queries ==========
routeSchema.index({ startLocation: '2dsphere' }); // Geospatial queries
routeSchema.index({ creator: 1, createdAt: -1 }); // User's routes sorted by creation date
routeSchema.index({ isPublic: 1, difficulty: 1, distance: 1 }); // Discovery filters
routeSchema.index({ tags: 1 }); // Tag-based discovery
routeSchema.index({ totalCompletions: -1 }); // Popular routes

// ========== METHODS ==========
// Calculate difficulty based on distance and elevationGain
// This is a data calculation
routeSchema.methods.calculateDifficulty = function() {
    const distance = this.distance;
    const elevationGain = this.elevationGain;

    // Difficulty score = distance (miles) + (elevation gain in meters / 100)
    const difficultyScore = distance + (elevationGain / 100);

    if (difficultyScore < 3) {
        this.difficulty = 'EASY';
    } else if (difficultyScore < 6) {
        this.difficulty = 'MODERATE';
    } else if (difficultyScore < 10) {
        this.difficulty = 'HARD';
    } else {
        this.difficulty = 'EXPERT';
    }
};

module.exports = mongoose.model('Route', routeSchema);