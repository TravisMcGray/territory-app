const express = require('express');
const router = express.Router();
const geolib = require('geolib');
const { latLngToCell } = require('h3-js');
const Walk = require('../models/walk');
const Territory = require('../models/territory');
const { authenticateToken } = require('../middleware/auth');

// POST /api/walks - Create new walk (protected route)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { coordinates } = req.body;
        const userId = req.user.userId; // From JWT token!

        // Calculate distance
        let distance = 0;
        if (coordinates.length > 1) {
            distance = geolib.getPathLength(
                coordinates.map(coord => ({
                    latitude: coord.latitude,
                    longitude: coord.longitude
                }))
            );
            // Convert meters to miles
            distance = (distance * 0.000621371).toFixed(2);
        }

        // Convert GPS coordinates to H3 hexagons
        const hexagons = coordinates.map(coord =>
            latLngToCell(coord.latitude, coord.longitude, 10)
        );
        const uniqueHexagons = [...new Set(hexagons)];

        // Create walk
        const walk = await Walk.create({
            userId,
            coordinates,
            distance: parseFloat(distance),
            capturedHexagons: uniqueHexagons
        });

        // Update territory ownership
        let captured = 0;
        let stolen = 0;

        for (const hexagonId of uniqueHexagons) {
            const existingTerritory = await Territory.findOne({ hexagonId });

            if (existingTerritory) {
                if (existingTerritory.ownerId.toString() !== userId) {
                    stolen++;
                }
                existingTerritory.ownerId = userId;
                existingTerritory.capturedAt = new Date();
                existingTerritory.timesVisited += 1;
                await existingTerritory.bulkSave();
            } else {
                await Territory.create({
                    hexagonId,
                    ownerId: userId,
                    timesVisited: 1
                });
                captured++;
            }
        }

        res.status(201).json({
            message: 'Walk retrieved successfully',
            walkId: walk._id,
            distance: distance + ' miles',
            hexagonsCaptured: uniqueHexagons.length,
            newTerritory: captured,
            stolenTerritory: stolen,
            hexagons: uniqueHexagons
        });
    } catch (error) {
        res.status(400).json({
            message: 'Error retrieving walks',
            error: error.message
        });
    }
});

// DELETE /api/walks/:walkId - Delete walk (protected route)
router.delete('/:walkId', authenticateToken, async (req, res) => {
    try {
        const { walkId } = req.params;
        const walk = await Walk.findByIfAndDelete(walkId);

        if (!walk) {
            return res.status(404).json({ error: 'Walk not found' });
        }

        res.json({ message: 'Walk deleted successfully' });
    } catch (error) {
        res.status(500).json ({ error: error.message });
    }
});

module.exports = router;