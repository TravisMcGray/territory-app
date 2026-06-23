const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
    // ========== BASIC INFO ==========
    name: {
        type: String,
        required: true,
        trim: true, // Strips leading/trailing whitespace
        maxlength: 100,
        index: true
    },
    description: {
        type: String,
        trim: true, // Strips leading/trailing whitespace
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
        required: true
        // No standalone index needed, covered by compound index below
    },

    // ========== STATISTICS (Updated by route handlers when attempts are recorded) ==========
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
        type: Number, // seconds (creator's estimate for expected completion time)
        default: null
    },

    // ========== GEOSPATIAL SEARCH ==========
    // Start location for "routes near me" queries
    // Uses GeoJSON Point format; the index defined below handles 2dsphere queries
    startLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
        }
    },

    // ========== TIMESTAMPS ==========
    // createdAt and updatedAt added automatically by Mongoose
},
{
    timestamps: true
});

// ========== INDEXES FOR EFFICIENT QUERIES ==========
routeSchema.index({ createdAt: -1 }); // Timestamp-based sorting
routeSchema.index({ startLocation: '2dsphere' }); // Geospatial "routes near me" queries
routeSchema.index({ creator: 1, createdAt: -1 }); // User's routes sorted by creation date
routeSchema.index({ isPublic: 1, difficulty: 1, distance: 1 }); // Discovery filters
routeSchema.index({ tags: 1 }); // Tag-based discovery
routeSchema.index({ totalCompletions: -1 }); // Popular routes leaderboard

// ========== METHODS ==========
// Calculate and persist difficulty based on distance and elevationGain
// Call this after creating or updating a route's distance/elevation
// Difficulty score = distance (miles) + (elevation gain in meters / 100)
routeSchema.methods.calculateDifficulty = async function() {
    const distance = this.distance;
    const elevationGain = this.elevationGain;

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

    await this.save(); // Persists the updated difficulty to the database
};

module.exports = mongoose.model('Route', routeSchema);