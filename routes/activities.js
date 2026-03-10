const express = require('express');
const mongoose = require('mongoose')
const router = express.Router();
const geolib = require('geolib');
const { latLngToCell } = require('h3-js');
const Activity = require('../models/activity');
const Territory = require('../models/territory');
const User = require('../models/user');
const Achievement = require('../models/achievement');
const ActivityComment = require('../models/activityComment');
const ActivityKudos = require('../models/activityKudos');
const { createActivityCommentNotification } = require('../utils/notifications');
const { authenticateToken } = require('../middleware/auth');
const {
    createFriendActivityNotification,
    createAchievementNotification,
    createTerritoryStolenNotification
} = require('../utils/notifications');

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

// ========== ACHIEVEMENT UNLOCK HELPER ==========

/**
 * Check and unlock achievements for user
 * @param {Object} user - User document with updated stats
 * @param {Object} activityData - Current activity data
 * @returns {Promise<Array>} Newly unlocked achievements
 */
const checkAndUnlockAchievements = async (user, activityData) => {
    try {
        // Get all achievements
        const allAchievements = await Achievement.find();

        // Filter achievements by activity type (only check relevant ones)
        const relevantAchievements = allAchievements.filter(achievement => {
            // Universal achievements apply to everyone
            if (achievement.activityType === 'UNIVERSAL') return true;

            // Only check WALK achievements for walk activities
            if (activityData.activityType === 'walk' && achievement.activityType === 'WALK') return true;
            
            // Only check RUN achievements for run activities
            if (activityData.activityType === 'run' && achievement.activityType === 'RUN') return true;

            return false;
        })

        // Get user's already unlocked achievement IDs
        const unlockedIds = user.achievements.map(a => a.achievementId.toString());

        const newlyUnlocked = [];

        // Check each achievement
        for (const achievement of relevantAchievements) {
            // Skip if already unlocked
            if (unlockedIds.includes(achievement._id.toString())) {
                continue;
            }

            // Get the field and value to check
            const { field, operator, value } = achievement.condition;
            let userValue;

            // Handle different field types
            if (field === 'followers') {
                userValue = user.followers ? user.followers.length : 0;
            } else if (field === 'singleActivityDistance') {
                userValue = activityData.distance;
            } else if (field === 'singleActivityHexagons') {
                userValue = activityData.hexagonsCount;
            } else if (field === 'totalActivities') {
                userValue = user.stats.totalWalks + user.stats.totalRuns;
            } else {
                // Safe property access for nested fields like 'stats.totalWalks'
                userValue = field.split('.').reduce((obj, key) => obj?.[key], user);
            }

            // Check condition
            let conditionMet = false;
            switch (operator) {
                case '>=':
                    conditionMet = userValue >= value;
                    break;
                case '<=':
                    conditionMet = userValue <= value;
                    break;
                case '>':
                    conditionMet = userValue > value;
                    break;
                case '<':
                    conditionMet = userValue < value;
                    break;
                case '==':
                    conditionMet = userValue == value;
                    break;
            }

            // If condition is met, unlock achievement
            if (conditionMet) {
                user.achievements.push({
                    achievementId: achievement._id,
                    unlockedAt: new Date()
                });
                newlyUnlocked.push(achievement);
            }
        }

        // Save user if achievements were unlocked
        if (newlyUnlocked.length > 0) {
            await user.save();
        }

        return newlyUnlocked;

    } catch (error) {
        // Silent fail - achievement check errors should not break activity recording
        return [];
    }
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
                code: 'INVALID_DURATION',
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
        // I do: atomic update for each territory (all at once)    
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

                                // Stealing rules:
                                // Walkers can never steal (may change this in future updates - reliant on feedback)
                                // Runners can only steal from other runners (not from walkers)
                                ownerId: {
                                    $cond: [
                                        // If this is a WALK activity
                                        { $eq: [activityType, 'walk'] },
                                        // Walkers: Keep the current owner (never steal)
                                        '$ownerId',
                                        // Runners: Check if we can steal
                                        {
                                            $cond: [
                                                // If territory owner is a walker
                                                { $eq: ['$ownerActivityType', 'WALK'] },
                                                // Can't steal from walkers, keep their ownership
                                                '$ownerId',
                                                // Owner is a runner, we can steal!
                                                userId
                                            ]
                                        }
                                    ]
                                },
                                
                                // Record what activity type now owns this territory
                                ownerActivityType: activityType === 'walk' ? 'WALK' : 'RUN',

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

        // Now count captured vs stolen from ACTUAL results
        let captured = 0;
        let stolen = 0;
        const stolenFromUsers = new Map(); // Track who was stolen from for notifications

        for (const territory of results) {
            if (!territory.previousOwnerId) {
                // No previous owner = newly captured
                captured++;
            } else if (territory.ownerId.toString() === userId.toString() && 
                    territory.previousOwnerId.toString() !== userId.toString()) {
                // We NOW own it AND we DIDN'T own it before = we actually stole it
                // If ownerId !== userId = we're just passing through (walker), don't count anything
                // If ownerId === userId && previousOwnerId === userId = revisit, don't count
                stolen++;

                // Track this victom (only if runner stole from runner)
                if (activityType === 'run') {
                    const victimId = territory.previousOwnerId.toString();
                    stolenFromUsers.set(victimId, (stolenFromUsers.get(victimId) || 0) + 1);
                }
            }
        }

        // Update activity with stolen count
        await Activity.findByIdAndUpdate(activity._id, { stolenHexagons: stolen });

        // Notify user with stolen count
        if (stolenFromUsers.size > 0) {
            const thiefUser = await User.findById(userId).select('username');
            for (const [victimId, hexCount] of stolenFromUsers) {
                await createTerritoryStolenNotification(victimId, thiefUser, hexCount);
            }
        }

        // ========== END ATOMIC CAPTURE ==========

        // Build stats update object
        const statUpdates = {
            $inc: {
                'stats.totalDistance': distance,
                'stats.totalHexagonsCaptured': uniqueHexagons.length,
                'stats.totalWalks': activityType === 'walk' ? 1 : 0,
                'stats.totalRuns': activityType === 'run' ? 1 : 0,
                'stats.totalStolenTerritories': stolen
            },
            $set: {
                lastLogin: new Date()
            }
        };

        // Update user stats atomically
        const updatedUser = await User.findByIdAndUpdate(userId, statUpdates, { new: true });

        // Check and unlock achievements
        const newlyUnlocked = await checkAndUnlockAchievements(updatedUser, {
            distance: distance,
            hexagonsCount: uniqueHexagons.length,
            activityType: activityType
        });

        // Notify user of newly unlocked achievements
        for (const achievement of newlyUnlocked) {
            await createAchievementNotification(req.user.userId, achievement);
        }

        // Check if user achieved the 100 hexagon milestone (unlocks username change ability)
        let milestone = null;
        const previousTotal = updatedUser.stats.totalHexagonsCaptured - uniqueHexagons.length;
        if (previousTotal < 100 && updatedUser.stats.totalHexagonsCaptured >= 100) {
            milestone = 'You can now change your username!';
        }

        // Notify followers of new activity
        const actorUser = await User.findById(userId).select('username followers');
        if (actorUser.followers && actorUser.followers.length > 0) {
            await createFriendActivityNotification(actorUser.followers, actorUser, {
                activityType: activityType,
                distance: distance,
                hexagonsCaptured: uniqueHexagons.length,
                _id: activity._id
            });
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
                estimatedCalories: Math.round(distance * (activityType === 'run' ? 0.63 : 0.30) * (updatedUser.weight || 154)),
                hexagonsCaptured: uniqueHexagons.length,
                newTerritory: captured,
                stolenTerritory: stolen
            },
            newAchievements: newlyUnlocked.length > 0 ? newlyUnlocked.map(a => ({
                name: a.name,
                description: a.description,
                rarity: a.rarity
            })) : [],
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
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error recording activity'
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
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error retrieving activities'
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
            return res.status(404).json({
                status: 'error',
                code: 'NOT_FOUND',
                message: 'Activity not found'
            });
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
        await session.abortTransaction();
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error deleting activity'
        });
    } finally {
        // Always close the session
        session.endSession();
    }
});

// ========== GET api/activities/feed - Activity feed from followed users ==========
router.get('/feed', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

        // Get user and their following list
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        // Convert following IDs for aggregation
        const followingIds = (user.following || []).map(id => new mongoose.Types.ObjectId(id));

        // If user has no following, return empty feed
        if (followingIds.length === 0) {
            return res.json({
                message: 'Feed retrieved successfully',
                pagination: {
                    page,
                    limit,
                    total: 0,
                    pages: 0
                },
                activities: []
            });
        }

        // Aggregation pipeline: get activities from followed users with social data
        const [result] = await Activity.aggregate([
            // Match activities from users you follow
            { $match: { userId: { $in: followingIds } } },

            // Facet: get both total count AND paginated results efficiently
            {
                $facet: {
                    metadata: [
                        { $count: 'total' }
                    ],
                    data: [
                        // Sort by most recent first
                        { $sort: { createdAt: -1 } },

                        // Pagination
                        { $skip: skip },
                        { $limit: limit },

                        // Lookup user info (username, avatar)
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'userId',
                                foreignField: '_id',
                                as: 'userInfo'
                            }
                        },

                        // Lookup kudos count for each activity
                        {
                            $lookup: {
                                from: 'activitykudos',
                                localField: '_id',
                                foreignField: 'activity',
                                as: 'kudos'
                            }
                        },

                        // Lookup comments count for each activity
                        {
                            $lookup: {
                                from: 'activitycomments',
                                localField: '_id',
                                foreignField: 'activity',
                                as: 'comments'
                            }
                        },

                        // Check if current user gave kudos to each activity
                        {
                            $lookup: {
                                from: 'activitykudos',
                                let: { activityId: '$_id' },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: {
                                                $and: [
                                                    { $eq: ['$activity', '$$activityId'] },
                                                    { $eq: ['$user', new mongoose.Types.ObjectId(userId)] }
                                                ]
                                            }
                                        }
                                    }
                                ],
                                as: 'userKudos'
                            }
                        },

                        // Unwind userInfo (converts array to single object)
                        { $unwind: '$userInfo' },

                        // Project only needed fields for feed with social data
{
                            $project: {
                                _id: 1,
                                activityType: 1,
                                distance: 1,
                                duration: 1,
                                elevationGain: 1,
                                estimatedCalories: {
                                    $round: [
                                        {
                                            $multiply: [
                                                '$distance',
                                                { $cond: [{ $eq: ['$activityType', 'run'] }, 0.63, 0.30] },
                                                154
                                            ]
                                        },
                                        0
                                    ]
                                },
                                capturedHexagons: { $size: '$capturedHexagons' },
                                stolenHexagons: 1,
                                coordinates: 1,
                                createdAt: 1,
                                username: '$userInfo.username',
                                avatar: '$userInfo.avatar',
                                userId: '$userInfo._id',
                                kudosCount: { $size: '$kudos' },
                                commentCount: { $size: '$comments' },
                                hasGivenKudos: { $gt: [{ $size: '$userKudos' }, 0] }
                            }
                        }
                    ]
                }
            }
        ]);

        // Extract metadata and data from facet result
        const total = result.metadata[0]?.total || 0;
        const activities = result.data || [];

        res.json({
            message: 'Feed retrieved successfully',
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
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error retrieving feed'
        });
    }
});

// ========== POST /api/activities/:activityId/comment - Add comment to activity ==========
router.post('/:activityId/comment', authenticateToken, async (req, res) => {
    try {
        const { activityId } = req.params;
        const { text } = req.body;
        const userId = req.user.userId;

        // Validate comment text
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_COMMENT',
                message: 'Comment text is required'
            });
        }

        if (text.length > 500) {
            return res.status(400).json({
                status: 'error',
                code: 'COMMENT_TOO_LONG',
                message: 'Comment must be 500 characters or less'
            });
        }

        // Verify activity exists
        const activity = await Activity.findById(activityId);
        if (!activity) {
            return res.status(404).json({
                status: 'error',
                code: 'ACTIVITY_NOT_FOUND',
                message: 'Activity not found'
            });
        }

        // Create comment
        const comment = await ActivityComment.create({
            activity: activityId,
            user: userId,
            text: text.trim()
        });

        // Populate user info for response
        await comment.populate('user', 'username avatar');

        // Notify activity owner (if commenter is not the owner)
        if (activity.userId.toString() !== userId) {
            const commenterUser = await User.findById(userId).select('username');
            await createActivityCommentNotification(
                activity.userId,
                commenterUser,
                activity
            );
        }

        res.status(201).json({
            message: 'Comment added successfully',
            comment: {
                id: comment._id,
                text: comment.text,
                user: {
                    id: comment.user._id,
                    username: comment.user.username,
                    avatar: comment.user.avatar
                },
                createdAt: comment.createdAt
            }
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error adding comment'
        });
    }
});

// ========== POST /api/activities/:activityId/kudos - Give kudos to activity ==========
router.post('/:activityId/kudos', authenticateToken, async (req, res) => {
    try {
        const { activityId } = req.params;
        const userId = req.user.userId;

        // Verify activity exists
        const activity = await Activity.findById(activityId);
        if (!activity) {
            return res.status(404).json({
                status: 'error',
                code: 'ACTIVITY_NOT_FOUND',
                message: 'Activity not found'
            });
        }

        // Can't kudos your own activity
        if (activity.userId.toString() === userId) {
            return res.status(400).json({
                status: 'error',
                code: 'CANNOT_KUDOS_OWN_ACTIVITY',
                message: 'You cannot give kudos to your own activity'
            });
        }

        // Check if already gave kudos
        const existingKudos = await ActivityKudos.findOne({
            activity: activityId,
            user: userId
        });

        if (existingKudos) {
            return res.status(400).json({
                status: 'error',
                code: 'ALREADY_GAVE_KUDOS',
                message: 'You already gave kudos to this activity'
            });
        }

        // Create kudos
        const kudos = await ActivityKudos.create({
            activity: activityId,
            user: userId
        });

        // Get total kudos count for this activity
        const kudosCount = await ActivityKudos.countDocuments({ activity: activityId });

        res.status(201).json({
            message: 'Kudos given successfully',
            kudos: {
                id: kudos._id,
                activityId: kudos.activity,
                createdAt: kudos.createdAt
            },
            totalKudos: kudosCount
        });

    } catch (error) {
        // Handle duplicate kudos error from unique index
        if (error.code === 11000) {
            return res.status(400).json({
                status: 'error',
                code: 'ALREADY_GAVE_KUDOS',
                message: 'You already gave kudos to this activity'
            });
        }

        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error giving kudos'
        });
    }
});

// ========== DELETE /api/activities/:activityId/kudos - Remove kudos from activity ==========
router.delete('/:activityId/kudos', authenticateToken, async (req, res) => {
    try {
        const { activityId } = req.params;
        const userId = req.user.userId;

        // Find and delete kudos
        const kudos = await ActivityKudos.findOneAndDelete({
            activity: activityId,
            user: userId
        });

        if (!kudos) {
            return res.status(404).json({
                status: 'error',
                code: 'KUDOS_NOT_FOUND',
                message: 'You have not given kudos to this activity'
            });
        }

        // Get remaining kudos count
        const kudosCount = await ActivityKudos.countDocuments({ activity: activityId });

        res.json({
            message: 'Kudos removed successfully',
            totalKudos: kudosCount
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error removing kudos'
        });
    }
});

// ========== GET /api/activities/:activityId - Get single activity with comments and kudos ==========
router.get('/:activityId', authenticateToken, async (req, res) => {
    try {
        const { activityId } = req.params;
        const userId = req.user.userId;

        // Get activity
        const activity = await Activity.findById(activityId)
            .populate('userId', 'username avatar');

        if (!activity) {
            return res.status(404).json({
                status: 'error',
                code: 'ACTIVITY_NOT_FOUND',
                message: 'Activity not found'
            });
        }

        // Fetch user for weight-based calorie calculation
        const user = await User.findById(req.user.userId).select('weight');

        // Get comments (most recent first, limit to 50)
        const comments = await ActivityComment.find({ activity: activityId })
            .populate('user', 'username avatar')
            .sort({ createdAt: -1 })
            .limit(50);

        // Get kudos count
        const kudosCount = await ActivityKudos.countDocuments({ activity: activityId });

        // Check if current user gave kudos
        const userKudos = await ActivityKudos.findOne({
            activity: activityId,
            user: userId
        });

        // Get recent kudos users (limit to 10)
        const recentKudos = await ActivityKudos.find({ activity: activityId })
            .populate('user', 'username avatar')
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({
            message: 'Activity retrieved successfully',
            activity: {
                id: activity._id,
                type: activity.activityType,
                distance: activity.distance,
                duration: activity.duration,
                pace: activity.pace,
                averageSpeed: activity.averageSpeed,
                elevationGain: activity.elevationGain,
                estimatedCalories: Math.round(activity.distance * (activity.activityType === 'run' ? 0.63 : 0.30) * (user?.weight || 154)),
                capturedHexagons: activity.capturedHexagons.length,
                stolenHexagons: activity.stolenHexagons,
                createdAt: activity.createdAt,
                user: {
                    id: activity.userId._id,
                    username: activity.userId.username,
                    avatar: activity.userId.avatar
                }
            },
            social: {
                kudosCount,
                commentCount: comments.length,
                hasGivenKudos: !!userKudos,
                recentKudos: recentKudos.map(k => ({
                    username: k.user.username,
                    avatar: k.user.avatar,
                    createdAt: k.createdAt
                })),
                comments: comments.map(c => ({
                    id: c._id,
                    text: c.text,
                    user: {
                        id: c.user._id,
                        username: c.user.username,
                        avatar: c.user.avatar
                    },
                    createdAt: c.createdAt
                }))
            }
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error retrieving activity'
        });
    }
});

module.exports = router;