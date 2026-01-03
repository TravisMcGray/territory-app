const express = require('express');
const mongoose = require('mongoose')
const router = express.Router();
const geolib = require('geolib');
const { latLngToCell } = require('h3-js');
const Activity = require('../models/activity');
const Territory = require('../models/territory');
const User = require('../models/user');
const { authenticateToken } = require('../middleware/auth');

// ========== VALIDATION HELPERS ==========

// Validate coordinate is within valid ranges
const isValidCoordinate = (lat, lng) => {
    return (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    );
};

// ========== POST /api/activities - Record a new activity (walk or run) ==========
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { coordinates, activityType, duration, elevationGain } = req.body;
        const userId = req.user.userId;

        // Validate activity type
        if (!activityType || !['walk', 'run'].includes(activityType)) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_ACTIVITY_TYPE',
                message: 'Activity type must be "walk" or "run"'
            });
        }

        // Validate coordinates exist and are array
        if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_COORDINATES',
                message: 'Coordinates must be a non-empty array'
            });
        }

        // Validate each coordinate
        for (let i = 0; i < coordinates.length; i++) {
            const { latitude, longitude } = coordinates[i];
            if (!isValidCoordinate(latitude, longitude)) {
                return res.status(400).json({
                    status: 'error',
                    code: 'INVALID_COORDINATE',
                    message: `Coordinate ${i} invalid. Latitude must be -90 to 90, longitude must be -180 to 180`,
                    index: i
                });
            }
        }

        // Validate duration (in seconds)
        if (!duration || typeof duration !== 'number' || duration <= 0) {
            return res.status(400).json({
                status: 'error',
                code: 'INAVLID_DURATION',
                message: 'Duration must be a positive number (seconds). For a 30-minute walk, send duration: 1800'
            });
        }

        // Calculate distance in miles
        let distance = 0;
        if (coordinates.length > 1) {
            const metersDistance = geolib.getPathLength(
                coordinates.map(coord => ({
                    latitude: coord.latitude,
                    longitude: coord.longitude
                }))
            );
            distance = parseFloat((metersDistance * 0.000621371).toFixed(2));
        }

        // Convert GPS to H3 hexagons (resolution 10)
        const hexagons = coordinates.map(coord =>
            latLngToCell(coord.latitude, coord.longitude, 10)
        );
        const uniqueHexagons = [...new Set(hexagons)];

        // Create activity record (with duration and elevationGain)
        const activity = await Activity.create({
            userId,
            activityType,
            coordinates,
            distance,
            duration,
            elevationGain: elevationGain || 0,
            capturedHexagons: uniqueHexagons
        });

        // ===== ATOMIC CAPTURE - PREVENTS RACE CONDITIONS =====
        // Instead of: fetch territories, loop, save each one
        // We do: atomic update for each territory (all at once)    
        // This prevents two users from both claiming the same hexagon

        const captureResults = [];

        for (const hexagonId of uniqueHexagons) {
            // findOneAndUpdate is ATOMIC = MongoDB handles this completely or not at all
            // No gap where another user can slip in :)

            captureResults.push(
                Territory.findOneAndUpdate(
                    { hexagonId }, // Find by hexagon ID

                    // Update using aggregation pipeline
                    // This lets us reference the OLD value before updating
                    [
                        {
                            $set: {
                                // Store who OWNED it BEFORE we change it
                                previousOwnerId: '$ownerId',

                                // Now update to current user
                                ownerId: userId,
                                capturedAt: new Date(),

                                // Track which activity captured this
                                capturedByActivityId: activity._id,

                                // Increment visits (using $add instead of seperate $inc stage)
                                timesVisited: { $add: ['$timesVisited', 1]}
                            }
                        },
                    ],

                    {
                        upsert: true, // Create if doesn't exist
                        new: true // Return updated document
                    }
                )
            );
        }

        // Execute all updates in parallel
        const results = await Promise.all(captureResults);

        // Now count captured vs stolent from ACTUAL results
        let captured = 0;
        let stolen = 0;

        for (const territory of results) {
            if (!territory.previousOwnerId) {
                // No previous owner = newly captured
                captured++;
            } else if (territory.previousOwnerId.toString() !== userId.toString()) {
                // Previous onwer was a different person = stolen
                stolen++;
            }
            // If previousOwnerId === userId = revisit (count neither)
        }

        // ========== END ATOMIC CAPTURE ==========

        // Build stats update object
        const statUpdates = {
            $inc: {
                'stats.totalDistance': distance,
                'stats.totalHexagonsCaptured': uniqueHexagons.length,
                'stats.totalWalks': activityType === 'walk' ? 1 : 0,
                'stats.totalRuns': activityType === 'run' ? 1 : 0
            },
            $set: {
                lastLogin: new Date()
            }
        };

        // Update user stats atomically
        const updatedUser = await User.findByIdAndUpdate(userId, statUpdates, { new: true });

        // Check if user achieved the 100 hexagon milestone (unlocks username change ability)
        let milestone = null;
        const previousTotal = updatedUser.stats.totalHexagonsCaptured - uniqueHexagons.length;
        if (previousTotal < 100 && updatedUser.stats.totalHexagonsCaptured >= 100) {
            milestone = 'You can now change your username!';
        }

        res.status(201).json({
            message: `${activityType === 'walk' ? 'Walk' : 'Run'} recorded successfully`,
            activity: {
                id: activity._id,
                type: activityType,
                distance: `${distance} miles`,
                duration: `${Math.round(activity.duration / 60)} minutes`,
                pace: `${activity.pace.toFixed(2)} min/mile`,
                speed: `${activity.averageSpeed.toFixed(2)} mph`,
                elevationGain: `${activity.elevationGain} m (${Math.round(activity.elevationGain * 3.28084)} ft)`,
                caloriesBurned: activity.estimatedCalories,
                hexagonsCaptured: uniqueHexagons.length,
                newTerritory: captured,
                stolenTerritory: stolen
            },
            milestone,
            userStats: {
                totalWalks: updatedUser.stats.totalWalks,
                totalRuns: updatedUser.stats.totalRuns,
                totalDistance: updatedUser.stats.totalDistance,
                totalHexagonsCaptured: updatedUser.stats.totalHexagonsCaptured,
                canChangeUsername: updatedUser.canChangeUsername()
            }
        });

    } catch (error) {
        res.status(400).json({
            message: 'Error recording activity',
            error: error.message
        });
    }
});

// ========== GET /api/activities - Get user's activity history with pagination ==========
router.get('/', authenticateToken, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const activityType = req.query.type;
        const skip = (page - 1) * limit;

        // Build query
        const query = { userId: req.user.userId };
        if (activityType && ['walk', 'run'].includes(activityType)) {
            query.activityType = activityType;
        }

        // Get total count
        const total = await Activity.countDocuments(query);

        // Get paginated activities
        const activities = await Activity.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            message: 'Activities retrieved successfully',
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            count: activities.length,
            activities
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error retrieving activities',
            error: error.message
        });
    }
});

// ========== DELETE /api/activities/:activityId - Delete an activity ==========
// IMPORTANT: This now uses transactions to revert all stats (as of update 01.02.26)
router.delete('/:activityId', authenticateToken, async (req, res) => {
    // Start a transaction (all-or-nothing operation)
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { activityId } = req.params;
        const userId = req.user.userId;

        // ===== Step 1: Verify activity exists and belongs to user =====
        const activity = await Activity.findById(activityId).session(session);

        if (!activity) {
            await session.abortTransaction();
            return res.status(400).json({ error: 'Activity not found' });
        }

        if (activity.userId.toString() !== userId.toString()) {
            await session.abortTransaction();
            return res.status(403).json({
                status: 'error',
                code: 'FORBIDDEN',
                message: 'You can only delete your own activities'
            });
        }

        // ===== Step 2: Find territories claimed by THIS activity =====
        // Key insight: only revert if still owned by same user
        // (if stolen, leave it with new owner)
        const territories = await Territory.find({
            capturedByActivityId: activityId,
            ownerId: userId
        }).session(session);

        const territoriesToRevert = territories.length;

        // ===== Step 3: Delete territories =====
        await Territory.deleteMany({
            _id: { $in: territories.map(t => t._id) }
        }).session(session)

        // ===== Step 4: revert user stats =====
        await User.findByIdAndUpdate(
            userId,
            {
                $inc: {
                    'stats.totalDistance': -activity.distance,
                    'stats.totalHexagonsCaptured': -territoriesToRevert
                }
            },
            { session }
        );

        // ===== Step 5: Revert activity counter =====
        const statUpdate = {};
        if (activity.activityType === 'walk') {
            statUpdate['stats.totalWalks'] = -1;
        } else if (activity.activityType === 'run') {
            statUpdate['stats.totalRuns'] = -1;
        }

        if (Object.keys(statUpdate).length > 0) {
            await User.findByIdAndUpdate(
                userId,
                { $inc: statUpdate },
                { session }
            )
        };

    // ===== Step 6: Delete activity =====
    await Activity.findByIdAndDelete(activityId).session(session);
    
    // ===== Step 7: If we got here, everything Succeeded =====
    await session.commitTransaction();

    res.json({
        message: 'Activity deleted successfully',
        reverted: {
            territories: territoriesToRevert,
            distance: activity.distance,
            hexagons: territoriesToRevert
        }
    });

    } catch (error) {
        // if anything failed, rollback EVERYTHING
        await session.abortTransaction();
        res.status(500).json({ error: error.message });
    } finally {
        // Always close the session
        session.endSession();
    }
});

module.exports = router;