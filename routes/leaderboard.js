const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { authenticateToken } = require('../middleware/auth');

// ========== GET /api/leaderboard - Get top users by hexagons captured ==========
router.get('/', async (req, res) => {
    try {
        const limit = Math.min(100, parseInt(req.query.limit) || 10); // Max 100, default 10
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const skip = (page - 1) * limit;

        // Use aggregation pipeline for efficient sorting and limiting
        const topUsers = await User.aggregate([
            // Step 1: Match only active users
            {
                $match: { isActive: true }
            },
            // Step 2: Sort by hexagons captured (descending)
            {
                $sort: { 'stats.totalHexagonsCaptured': -1 }
            },
            // Step 3: Add rank field
            {
                $setWindowFields: {
                    partitionBy: null,
                    sortBy: { 'stats.totalHexagonsCaptured': -1 },
                    output: {
                        rank: { $rank: {} }
                    }
                }
            },
            // Step 4: Skip to pagination
            {
                $skip: skip
            },
            // Step 5: Limit results
            {
                $limit: limit
            },
            // Step 6: Project only needed fields
            {
                $project: {
                    _id: 1,
                    rank: 1,
                    username: 1,
                    avatar: 1,
                    totalHexagons: '$stats.totalHexagonsCaptured',
                    totalDistance: '$stats.totalDistance',
                    totalWalks: '$stats.totalWalks'
                }
            }
        ]);

        // Get total count for pagination
        const total = await User.countDocuments({ isActive: true });

        res.json({
            message: 'Leaderboard retrieved successfully',
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            count: topUsers.length,
            leaderboard: topUsers
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error retrieving leaderboard',
            error: error.message
        });
    }
});

// ========== GET /api/leaderboard/rank - Get user's rank ==========
router.get('/rank', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get user's total hexagons
        const user = await User.findById(userId).select('stats.totalHexagonsCaptured');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Count how many users have more hexagons (to determine rank)
        const rank = await User.countDocuments({
            isActive: true,
            'stats.totalHexagonsCaptured': { $gt: user.stats.totalHexagonsCaptured }
        }) + 1;

        // Get total active users
        const total = await User.countDocuments({ isActive: true });

        res.json({
            message: 'User rank retrieved successfully',
            rank,
            totalUsers: total,
            userHexagons: user.stats.totalHexagonsCaptured,
            percentile: Math.round((rank / total) * 100)
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error retrieving user rank',
            error: error.message
        });
    }
});

module.exports = router;