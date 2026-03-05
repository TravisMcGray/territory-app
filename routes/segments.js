const express = require('express');
const router = express.Router();
const geolib = require('geolib');
const { latLngToCell } = require('h3-js');
const Segment = require('../models/segment');
const SegmentAttempt = require('../models/segmentAttempt');
const UserSegmentRecord = require('../models/userSegmentRecord');
const User = require('../models/user');
const { createSegmentRecordNotification } = require('../utils/notifications');
const { authenticateToken } = require('../middleware/auth');

// ========== POST /api/segments - Create new segment ==========
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, description, coordinates, difficulty } = req.body;
        const userId = req.user.userId;

        // Validate
        if (!name || !coordinates || coordinates.length < 2) {
            return res.status(400).json({
                status: 'error',
                message: 'Name and at least 2 coordinates required'
            });
        }

        // Create segment
        const segment = await Segment.create({
            name,
            description,
            coordinates,
            difficulty: difficulty || 'medium',
            creator: userId
        });

        res.status(201).json({
            message: 'Segment created successfully',
            segment: {
                id: segment._id,
                name: segment.name,
                difficulty: segment.difficulty,
                coordinates: segment.coordinates,
                creator: segment.creator,
                createdAt: segment.createdAt
            }
        });

    } catch (error) {
        res.status(400).json({
            message: 'Error creating segment',
            error: error.message
        });
    }
});

// ========== GET /api/segments - List all segments (paginated) ==========
router.get('/', async(req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const difficulty = req.query.difficulty;
        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) {
            query.difficulty = difficulty;
        }

        // Get total count
        const total = await Segment.countDocuments(query);

        // Get paginated segments
        const segments = await Segment.find(query)
            .populate('creator', 'username avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            message: 'Segments retrieved successfully',
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            count: segments.length,
            segments
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error retrieving segments',
            error: error.message
        });
    }
});

// ========== GET /api/segments/:segmentId - Get specific segment ==========
router.get('/:segmentId', async (req,res) => {
    try {
        const segment = await Segment.findById(req.params.segmentId)
        .populate('creator', 'username avatar')
        .populate('territoryMaster.userId', 'username');

        if (!segment) {
            return res.status(404).json({ error: 'Segment not found' });
        }

        res.json({
            message: 'Segment retrieved successfully',
            segment
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error retrieving segment',
            error: error.message
        });
    }
});

// ========== PUT /api/segments/:segmentId - Update segment ==========
router.put('/:segmentId', authenticateToken, async (req, res) => {
    try {
        const { segmentId } = req.params;
        const { name, description, difficulty } = req.body;
        const userId = req.user.userId;

        // Get segment
        const segment = await Segment.findById(segmentId);

        if (!segment) {
            return res.status(404).json({ error: 'Segment not found' });
        }

        // Verify ownership
        if (segment.creator.toString() !== userId.toString()) {
            return res.status(403).json({
                status: 'error',
                message: 'You can only edit your own segments'
            });
        }

        // Update
        if (name) segment.name = name;
        if (description) segment.description = description;
        if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) {
            segment.difficulty = difficulty;
        }

        await segment.save();

        res.json({
            message: 'Segment updated successfully',
            segment
        });

    } catch (error) {
        res.status(400).json({
            message: 'Error updating segment',
            error: error.message
        });
    }
});

// ========== DELETE /api/segments/:segmentId - Delete segment ==========
router.delete('/:segmentId', authenticateToken, async(req, res) => {
    try {
        const { segmentId } = req.params;
        const userId = req.user.userId;

        // Get segment
        const segment = await Segment.findById(segmentId);

        if (!segment) {
            return res.status(404).json({ error: 'Segment not found' });
        }

        // Verify ownership
        if (segment.creator.toString() !== userId.toString()) {
            return res.status(403).json({
                status: 'error',
                message: 'You can only delete your own segments'
            });
        }

        // Delete segment and all related records
        await Segment.findByIdAndDelete(segmentId);
        await SegmentAttempt.deleteMany({ segmentId });
        await UserSegmentRecord.deleteMany({ segmentId });

        res.json({
            message: 'Segment deleted successfully',
            deletedSegmentId: segmentId
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error deleting segment',
            error: error.message
        });
    }
});

// ========== POST /api/segments/:segmentId/attempt - Record completion ==========
router.post('/:segmentId/attempt', authenticateToken, async(req, res) => {
    try {
        const { segmentId } = req.params;
        const { coordinates, duration, elevationGain } = req.body;
        const userId = req.user.userId;

        // ===== Step 1: Fetch current user ONCE - reuse everywhere below =====
        const currentUser = await User.findById(userId).select('username');
        if (!currentUser) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        // ===== Step 2: Validate inputs before any writes =====
        if (!coordinates || coordinates.length < 2) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_COORDINATES',
                message: 'Coordinates required'
            });
        }

        if (!duration || typeof duration !== 'number' || duration <= 0) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_DURATION',
                message: 'Duration must be positive number (seconds)'
            });
        }

        // ===== Step 3: Fetch segment =====
        const segment = await Segment.findById(segmentId);
        if (!segment) {
            return res.status(404).json({
                status: 'error',
                code: 'SEGMENT_NOT_FOUND',
                message: 'Segment not found'
            });
        }

        // ===== Step 4: Calculate distance =====
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

        // ===== Step 5: Convert to H3 hexagons =====
        const hexagons = coordinates.map(coord =>
            latLngToCell(coord.latitude, coord.longitude, 10)
        );
        const uniqueHexagons = [...new Set(hexagons)];

        // ===== Step 6: Check Territory Master =====
        let isNewTerritoryMaster = false;
        let previousTerritoryMasterTime = null;

        if (!segment.territoryMaster || !segment.territoryMaster.time || duration < segment.territoryMaster.time) {
            isNewTerritoryMaster = true;
            previousTerritoryMasterTime = segment.territoryMaster?.time || null;
        }

        // ===== Step 7: Create attempt record =====
        const attempt = await SegmentAttempt.create({
            segmentId,
            userId,
            time: duration,
            distance,
            elevationGain: elevationGain || 0,
            coordinates,
            capturedHexagons: uniqueHexagons,
            hexagonCount: uniqueHexagons.length,
            isNewTerritoryMaster,
            previousTerritoryMaster: previousTerritoryMasterTime
        });

        // ===== Step 8: Update segment stats =====
        segment.totalAttempts += 1;

        // ===== Step 9: Update Territory Master if new record =====
        if (isNewTerritoryMaster) {
            // Notify previous holder if there was one and it wasn't the same user
            if (segment.territoryMaster && segment.territoryMaster.userId) {
                const previousHolderId = segment.territoryMaster.userId.toString();

                if (previousHolderId !== userId.toString()) {
                    const timeDifference = previousTerritoryMasterTime - duration;
                    await createSegmentRecordNotification(
                        previousHolderId,
                        currentUser,  // already fetched at top - no second lookup needed
                        segment,
                        timeDifference
                    );
                }
            }

            // Use currentUser.username - already verified not null at top of route
            segment.territoryMaster = {
                userId,
                username: currentUser.username,
                time: duration,
                heldSince: new Date()
            };
        }

        await segment.save();

        // ===== Step 10: Update or create UserSegmentRecord =====
        let userRecord = await UserSegmentRecord.findOne({ userId, segmentId });

        if (!userRecord) {
            userRecord = await UserSegmentRecord.create({
                userId,
                segmentId,
                personalBest: duration,
                attempts: 1,
                territoryStrength: 1,
                totalHexagonsCaptured: uniqueHexagons.length,
                holdsTerritoryMaster: isNewTerritoryMaster,
                territoryMasterSince: isNewTerritoryMaster ? new Date() : null,
                lastAttempt: new Date()
            });
        } else {
            userRecord.attempts += 1;
            userRecord.lastAttempt = new Date();
            userRecord.totalHexagonsCaptured += uniqueHexagons.length;

            if (duration < userRecord.personalBest) {
                userRecord.personalBest = duration;
            }

            if (isNewTerritoryMaster) {
                userRecord.holdsTerritoryMaster = true;
                userRecord.territoryMasterSince = new Date();
            }

            userRecord.territoryStrength = Math.min(10, userRecord.attempts);
            await userRecord.save();
        }

        // ===== Step 11: Return clean response =====
        res.status(201).json({
            message: 'Segment attempt recorded successfully',
            attempt: {
                id: attempt._id,
                time: duration,
                distance,
                hexagonsCaptured: uniqueHexagons.length,
                isNewTerritoryMaster,
                previousTerritoryMasterTime
            },
            userRecord: {
                attempts: userRecord.attempts,
                personalBest: userRecord.personalBest,
                territoryStrength: userRecord.territoryStrength,
                holdsTerritoryMaster: userRecord.holdsTerritoryMaster
            }
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error recording attempt'
        });
    }
});

// ========== GET /api/segments/:segmentId/leaderboard - Segment leaderboard ==========
router.get('/:segmentId/leaderboard', async(req,res) => {
    try {
        const { segmentId } = req.params;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

        // Get segment
        const segment = await Segment.findById(segmentId);
        if (!segment) {
            return res.status(404).json({ error: 'Segment not found' });
        }

        // Get all attempts on this segment, sorted by time
        const totalAttempts = await SegmentAttempt.countDocuments({ segmentId });

        const leaderboard = await SegmentAttempt.find({ segmentId })
        .populate('userId', 'username avatar')
        .sort({ time: 1 }) // Fastest first
        .skip(skip)
        .limit(limit);

        // Add rank to each entry
        const rankedLeaderboard = leaderboard.map((attempt, index) => ({
            rank: skip + index + 1,
            userId: attempt.userId._id,
            username: attempt.userId.username,
            avatar: attempt.userId.avatar,
            time: attempt.time,
            distance: attempt.distance,
            hexagons: attempt.hexagonCount,
            isCurrentTM: segment.territoryMaster?.userId.toString() === attempt.userId._id.toString(),
            completedAt: attempt.createdAt
        }));

        res.json({
            message: 'Leaderboard retrieved successfully',
            segment: {
                id: segment._id,
                name: segment.name,
                totalAttempts: segment.totalAttempts
            },
            territoryMaster: segment.territoryMaster ? {
                username: segment.territoryMaster.username,
                time: segment.territoryMaster.time,
                heldSince: segment.territoryMaster.heldSince
            } : null,
            pagination: {
                page,
                limit,
                total: totalAttempts,
                pages: Math.ceil(totalAttempts / limit)
            },
            leaderboard: rankedLeaderboard
        });

    } catch (error) {
        res.status(500).json({ 
            message: 'Error retrieving leaderboard',
            error: error.message
        });
    }
});

module.exports = router;