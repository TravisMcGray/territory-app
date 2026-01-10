const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { authenticateToken } = require('../middleware/auth');

// ========== CONSTANTS ==========
const LEADERBOARD_LIMITS = {
    MIN: 1,
    DEFAULT: 10,
    MAX: 100
};

const LEADERBOARD_METRICS = {
    HEXAGONS: {
        field: 'stats.totalHexagonsCaptured',
        displayName: 'Total Hexagons',
        shortName: 'hexagons'
    },
    DISTANCE: {
        field: 'stats.totalDistance',
        displayName: 'Total Distance (miles)',
        shortName: 'distance'
    },
    ACTIVITY: {
        field: 'activityScore', // Calculated field: totalWalks + totalRuns
        displayName: 'Total Activities',
        shortName: 'activity'
    }
};

// ========== HELPER FUNCTIONS ==========

/**
 * Validate and normalize pagination parameters
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page
 * @returns {Object} { page, limit, skip }
 */
const getPaginationParams = (page, limit) => {
    const normalizedPage = Math.max(LEADERBOARD_LIMITS.MIN, parseInt(page) || 1);
    const normalizedLimit = Math.min(
        LEADERBOARD_LIMITS.MAX,
        Math.max(LEADERBOARD_LIMITS.MIN, parseInt(limit) || LEADERBOARD_LIMITS.DEFAULT)
    );
    const skip = (normalizedPage - 1) * normalizedLimit;
    
    return { page: normalizedPage, limit: normalizedLimit, skip };
};

/**
 * Get leaderboard for a specific metric
 * @param {string} metricKey - Key from LEADERBOARD_METRICS
 * @param {Object} pagination - { page, limit, skip }
 * @returns {Promise<Array>} Top users for the metric
 */
const getLeaderboardData = async (metricKey, pagination) => {
    const metric = LEADERBOARD_METRICS[metricKey];
    
    if (!metric) {
        throw new Error(`Invalid metric: ${metricKey}`);
    }

    // For activity metric, we need to calculate the score
    const pipeline = [
        { $match: { isActive: true } },
    ];

    // Add activity score calculation for activity leaderboard
    if (metricKey === 'ACTIVITY') {
        pipeline.push({
            $addFields: {
                activityScore: {
                    $add: ['$stats.totalWalks', '$stats.totalRuns']
                }
            }
        });
    }
    // Add sorting, ranking, and pagination
    pipeline.push(
        // Sort by the metric
        {
            $sort: { [metric.field]: -1 }
        },
        // Add rank
        {
            $setWindowFields: {
                partitionBy: null,
                sortBy: { [metric.field]: -1 },
                output: {
                    rank: { $rank: {} }
                }
            }
        },
        // Pagination
        { $skip: pagination.skip },
        { $limit: pagination.limit }
    );

    // Build projection - Only include activityScore if it's the ACTIVITY metric
    const projectStage = {
        _id: 1,
        rank: 1,
        username: 1,
        avatar: 1,
        stats: 1
    };

    if (metricKey === 'ACTIVITY') {
        projectStage.activityScore = 1;
    }

    pipeline.push({ $project: projectStage });

    return await User.aggregate(pipeline);
};

/**
 * Get user's rank and nearby users for context
 * @param {string} userId - User's MongoDB ID
 * @param {string} metricKey - Key from LEADERBOARD_METRICS
 * @param {number} contextLimit - How many users to show before/after
 * @returns {Promise<Object>} { userRank, nearbyUsers, userValue }
 */
const getUserRankWithContext = async (userId, metricKey, contextLimit = 2) => {
    const metric = LEADERBOARD_METRICS[metricKey];
    const user = await User.findById(userId).select('stats');

    if (!user) {
        throw new Error('User not found');
    }

    // Get the user's metric value
    let userValue;
    if (metricKey === 'ACTIVITY') {
        userValue = user.stats.totalWalks + user.stats.totalRuns;
    } else {
        userValue = eval(`user.${metric.field}`);
    }

    // Count how many users are ahead (rank calculation)
    const pipeline = [
        { $match: { isActive: true } },
    ];

    if (metricKey === 'ACTIVITY') {
        pipeline.push({
            $addFields: {
                activityScore: { $add: ['$stats.totalWalks', '$stats.totalRuns'] }
            }
        });
    }

    pipeline.push({
        $match: { [metric.field]: { $gt: userValue } }
    });

    const usersAhead = await User.aggregate(pipeline).count('count');
    const userRank = (usersAhead[0]?.count || 0) + 1;

    // Get nearby users for context (top performers around user's rank)
    const contextPipeline = [
        { $match: { isActive: true } },
    ];

    if (metricKey === 'ACTIVITY') {
        contextPipeline.push({
            $addFields: {
                activityScore: { $add: ['$stats.totalWalks', '$stats.totalRuns'] }
            }
        });
    }

    contextPipeline.push(
        { $sort: { [metric.field]: -1 } },
        { $setWindowFields: {
            partitionBy: null,
            sortBy: { [metric.field]: -1 },
            output: { rank: { $rank: {} } }
        }},
        { $match: { rank: { $gte: Math.max(1, userRank - contextLimit), $lte: userRank + contextLimit } } },
    );
    // Build projection for context - Only include activityScore if it's the ACTIVITY metric
    const contextProjectStage = {
        _id: 1,
        rank: 1,
        username: 1,
        avatar: 1,
        stats: 1,
    };

    if (metricKey === 'ACTIVITY') {
        contextProjectStage.activityScore = 1;
    }
    
    contextPipeline.push({ $project: contextProjectStage });

    const nearbyUsers = await User.aggregate(contextPipeline);

    return {
        userRank,
        userValue,
        nearbyUsers
    };
};

/**
 * Format leaderboard response
 * @param {Array} users - Array of user documents
 * @param {Object} pagination - { page, limit, total }
 * @param {string} metricKey - Leaderboard metric
 * @returns {Object} Formatted response
 */
const formatLeaderboardResponse = (users, pagination, metricKey) => {
    const metric = LEADERBOARD_METRICS[metricKey];
    
    const formattedUsers = users.map(user => {
        const baseData = {
            rank: user.rank,
            id: user._id,
            username: user.username,
            avatar: user.avatar
        };

        // Add metric-specific data
        switch (metricKey) {
            case 'HEXAGONS':
                return { ...baseData, hexagons: user.stats.totalHexagonsCaptured };
            case 'DISTANCE':
                return { ...baseData, distance: parseFloat(user.stats.totalDistance.toFixed(2)) };
            case 'ACTIVITY':
                return {
                    ...baseData,
                    totalWalks: user.stats.totalWalks,
                    totalRuns: user.stats.totalRuns,
                    totalActivities: user.activityScore
                };
            default:
                return baseData;
        }
    });

    return {
        metric: metric.displayName,
        metricType: metric.shortName,
        pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            pages: Math.ceil(pagination.total / pagination.limit)
        },
        count: formattedUsers.length,
        leaderboard: formattedUsers
    };
};

// ========== GET /api/leaderboard/hexagons - Top hexagon capturers ==========
router.get('/hexagons', async (req, res) => {
    try {
        const pagination = getPaginationParams(req.query.page, req.query.limit);
        const topUsers = await getLeaderboardData('HEXAGONS', pagination);
        const total = await User.countDocuments({ isActive: true });

        const response = formatLeaderboardResponse(topUsers, { ...pagination, total }, 'HEXAGONS');

        res.json({
            message: 'Hexagon leaderboard retrieved successfully',
            ...response
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error retrieving hexagon leaderboard',
            error: error.message
        });
    }
});

// ========== GET /api/leaderboard/distance - Top distance travelers ==========
router.get('/distance', async (req, res) => {
    try {
        const pagination = getPaginationParams(req.query.page, req.query.limit);
        const topUsers = await getLeaderboardData('DISTANCE', pagination);
        const total = await User.countDocuments({ isActive: true });

        const response = formatLeaderboardResponse(topUsers, { ...pagination, total }, 'DISTANCE');

        res.json({
            message: 'Distance leaderboard retrieved successfully',
            ...response
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error retrieving distance leaderboard',
            error: error.message
        });
    }
});

// ========== GET /api/leaderboard/activity - Most active users ==========
router.get('/activity', async (req, res) => {
    try {
        const pagination = getPaginationParams(req.query.page, req.query.limit);
        const topUsers = await getLeaderboardData('ACTIVITY', pagination);
        const total = await User.countDocuments({ isActive: true });

        const response = formatLeaderboardResponse(topUsers, { ...pagination, total }, 'ACTIVITY');

        res.json({
            message: 'Activity leaderboard retrieved successfully',
            ...response
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error retrieving activity leaderboard',
            error: error.message
        });
    }
});

// ========== GET /api/leaderboard/:metric/rank - Get user's rank on a specific metric ==========
router.get('/:metric/rank', authenticateToken, async (req, res) => {
    try {
        const { metric } = req.params;
        const userId = req.user.userId;

        // Validate metric
        if (!LEADERBOARD_METRICS[metric.toUpperCase()]) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_METRIC',
                message: `Invalid metric. Must be one of: ${Object.keys(LEADERBOARD_METRICS).map(k => LEADERBOARD_METRICS[k].shortName).join(', ')}`
            });
        }

        const contextLimit = Math.min(5, parseInt(req.query.context) || 2);
        const rankData = await getUserRankWithContext(userId, metric.toUpperCase(), contextLimit);
        const total = await User.countDocuments({ isActive: true });

        const metricName = LEADERBOARD_METRICS[metric.toUpperCase()].displayName;

        res.json({
            message: `User rank retrieved for ${metricName}`,
            metric: metricName,
            rank: rankData.userRank,
            value: rankData.userValue,
            totalUsers: total,
            percentile: Math.round((rankData.userRank / total) * 100),
            context: {
                nearby: rankData.nearbyUsers.map(u => ({
                    rank: u.rank,
                    username: u.username,
                    value: metric.toUpperCase() === 'ACTIVITY' 
                        ? u.activityScore 
                        : metric.toUpperCase() === 'HEXAGONS'
                        ? u.stats.totalHexagonsCaptured
                        : u.stats.totalDistance
                }))
            }
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error retrieving user rank',
            error: error.message
        });
    }
});

module.exports = router;