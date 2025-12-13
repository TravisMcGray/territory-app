const express = require('express');
const router = express.Router();
const geolib = require('geolib');
const { latLngToCell } = require('h3-js');
const Walk = require('../models/walk');
const Territory = require('../models/territory');
const User = require('../models/user');
const { authenticateToken } = require('../middleware/auth');

// POST /api/walks - Record a new walk and capture territory
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { coordinates } = req.body;
        const userId = req.user.userId;

        if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
            return res.status(400).json({ error: 'Valid coordinates array is required' });
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

        // Convert GPS to H3 hexagons (resolution 10 = ~66m hexagons)
        const hexagons = coordinates.map(coord =>
            latLngToCell(coord.latitude, coord.longitude, 10)
        );
        const uniqueHexagons = [...new Set(hexagons)];

        // Create walk record
        const walk = await Walk.create({
            userId,
            coordinates,
            distance,
            capturedHexagons: uniqueHexagons
        });

        // Update territory and count new/stolen hexagons
        let captured = 0;
        let stolen = 0;

        for (const hexagonId of uniqueHexagons) {
            const existingTerritory = await Territory.findOne({ hexagonId });

            if (existingTerritory) {
                // Hexagon already owned
                if (existingTerritory.ownerId.toString() !== userId.toString()) {
                    stolen++;
                }
                // Update ownership
                existingTerritory.ownerId = userId;
                existingTerritory.capturedAt = new Date();
                existingTerritory.timesVisited += 1;
                await existingTerritory.save();
            } else {
                // New hexagon captured
                await Territory.create({
                    hexagonId,
                    ownerId: userId,
                    timesVisited: 1
                });
                captured++;
            }
        }

        // Update user stats atomically
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $inc: {
                    'stats.totalWalks': 1,
                    'stats.totalDistance': distance,
                    'stats.totalHexagonsCaptured': uniqueHexagons.length
                },
                lastLogin: new Date()
            },
            { new: true }
        );

        // Check if user hit 100 hexagon milestone
        let milestone = null;
        const previousTotal = updatedUser.stats.totalHexagonsCaptured - uniqueHexagons.length;
        if (previousTotal < 100 && updatedUser.stats.totalHexagonsCaptured >= 100) {
            milestone = '🎉 You can now change your username!';
        }

        res.status(201).json({
            message: 'Walk recorded successfully',
            walk: {
                id: walk._id,
                distance: `${distance} miles`,
                hexagonsCaptured: uniqueHexagons.length,
                newTerritory: captured,
                stolenTerritory: stolen
            },
            milestone,
            userStats: {
                totalWalks: updatedUser.stats.totalWalks,
                totalDistance: updatedUser.stats.totalDistance,
                totalHexagonsCaptured: updatedUser.stats.totalHexagonsCaptured,
                canChangeUsername: updatedUser.canChangeUsername()
            }
        });
    } catch (error) {
        res.status(400).json({
            message: 'Error recording walk',
            error: error.message
        });
    }
});

// GET /api/walks - Get user's walk history
router.get('/', authenticateToken, async (req, res) => {
    try {
        const walks = await Walk.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({
            message: 'Walks retrieved successfully',
            count: walks.length,
            walks
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error retrieving walks',
            error: error.message
        });
    }
});

// DELETE /api/walks/:walkId - Delete a walk
router.delete('/:walkId', authenticateToken, async (req, res) => {
    try {
        const { walkId } = req.params;
        const walk = await Walk.findByIdAndDelete(walkId);

        if (!walk) {
            return res.status(404).json({ error: 'Walk not found' });
        }

        // TODO: Reverse territory updates if needed (complex logic)
        // For now, just delete the walk record

        res.json({ message: 'Walk deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;