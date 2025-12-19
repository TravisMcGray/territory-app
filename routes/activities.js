const express = require('express');
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
        const { coordinates, activityType } = req.body;
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

        // Create activity record
        const activity = await Activity.create({
            userId,
            activityType,
            coordinates,
            distance,
            capturedHexagons: uniqueHexagons
        });

        // ========== OPTIMIZED: Batch query instead of N+1 ==========
        // Get ALL existing territories in ONE query
        const existingTerritories = await Territory.find({
            hexagonId: { $in: uniqueHexagons }
        });

        // Convert to Map for fast O(1) lookup
        const territoryMap = new Map(
            existingTerritories.map(t => [t.hexagonId, t])
        );

        // Track stats
        let captured = 0;
        let stolen = 0;
        const updateOperations = [];
        const createOperations = [];

        // Loop through hexagons (no database calls in this loop)
        for (const hexagonId of uniqueHexagons) {
            const existingTerritory = territoryMap.get(hexagonId);

            if (existingTerritory) {
                // Hexagon already owned
                if (existingTerritory.ownerId.toString() !== userId.toString()) {
                    stolen++;
                }
                // Queue update operation
                existingTerritory.ownerId = userId;
                existingTerritory.capturedAt = new Date();
                existingTerritory.timesVisited += 1;
                updateOperations.push(existingTerritory.save());
            } else {
                // New hexagon
                captured++;
                // Queue create operation
                createOperations.push(
                    Territory.create({
                        hexagonId,
                        ownerId: userId,
                        timesVisited: 1
                    })
                );
            }
        }

        // Execute all saves and creates in parallel
        await Promise.all([...updateOperations, ...createOperations]);

        // Build stats update object
        const statUpdates = {
            $inc: {
                'stats.totalDistance': distance,
                'stats.totalHexagonsCaptured': uniqueHexagons.length
            },
            lastLogin: new Date()
        };

        // Increment appropriate activity counter
        if (activityType === 'walk') {
            statUpdates.$inc['stats.totalWalks'] = 1;
        } else if (activityType === 'run') {
            statUpdates.$inc['stats.totalRuns'] = 1;
        }

        // Update user stats atomically
        const updatedUser = await User.findByIdAndUpdate(userId, statUpdates, { new: true });

// Check if user achieved the 100 hexagon milestone (unlocks username change ability)        let milestone = null;
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
router.delete('/:activityId', authenticateToken, async (req, res) => {
    try {
        const { activityId } = req.params;

        // Verify activity belongs to user
        const activity = await Activity.findById(activityId);
        if (!activity) {
            return res.status(404).json({ error: 'Activity not found' });
        }

        if (activity.userId.toString() !== req.user.userId.toString()) {
            return res.status(403).json({
                status: 'error',
                code: 'FORBIDDEN',
                message: 'You can only delete your own activities'
            });
        }

        // Delete activity
        await Activity.findByIdAndDelete(activityId);

        // TODO: Reverse territory updates if needed (complex logic)
        // For now, activity is deleted but territory ownership remains

        res.json({ message: 'Activity deleted successfully' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;