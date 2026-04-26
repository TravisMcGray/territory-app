const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/user');
const Activity = require('../models/activity');
const { createNewFollowerNotification } = require('../utils/notifications');
const { authenticateToken } = require('../middleware/auth');

// ========== POST /api/users/:userId/follow - Follow a user ==========
router.post('/:userId/follow', authenticateToken, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId: currentUserId } = req.user;
        const { userId: targetUserId } = req.params;

        if (!targetUserId || targetUserId.length !== 24) {
            await session.abortTransaction();
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_USER_ID',
                message: 'Invalid user ID format'
            });
        }

        if (currentUserId === targetUserId) {
            await session.abortTransaction();
            return res.status(400).json({
                status: 'error',
                code: 'CANNOT_FOLLOW_SELF',
                message: 'You cannot follow yourself'
            });
        }

        const currentUser = await User.findById(currentUserId).session(session);
        if (!currentUser) {
            await session.abortTransaction();
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'Current user not found'
            });
        }

        const targetUser = await User.findById(targetUserId).session(session);
        if (!targetUser) {
            await session.abortTransaction();
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        if (!currentUser.following) currentUser.following = [];
        if (!targetUser.followers) targetUser.followers = [];

        if (currentUser.isFollowing(targetUserId)) {
            await session.abortTransaction();
            return res.status(400).json({
                status: 'error',
                code: 'ALREADY_FOLLOWING',
                message: 'You are already following this user'
            });
        }

        currentUser.following.push(targetUserId);
        await currentUser.save({ session });

        targetUser.followers.push(currentUserId);
        await targetUser.save({ session });

        await session.commitTransaction();

        // Notification outside transaction — non-fatal if it fails
        await createNewFollowerNotification(targetUserId, currentUser);

        res.status(200).json({
            message: `You are now following ${targetUser.username}`,
            followingUser: targetUser.toPublicJSON(),
            followerStats: {
                followersCount: targetUser.followers.length,
                followingCount: currentUser.following.length
            }
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error following user'
        });
    } finally {
        session.endSession();
    }
});

// ========== DELETE /api/users/:userId/follow - Unfollow a user ==========
router.delete('/:userId/follow', authenticateToken, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId: currentUserId } = req.user;
        const { userId: targetUserId } = req.params;

        if (!targetUserId || targetUserId.length !== 24) {
            await session.abortTransaction();
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_USER_ID',
                message: 'Invalid user ID format'
            });
        }

        const currentUser = await User.findById(currentUserId).session(session);
        if (!currentUser) {
            await session.abortTransaction();
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'Current user not found'
            });
        }

        const targetUser = await User.findById(targetUserId).session(session);
        if (!targetUser) {
            await session.abortTransaction();
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        if (!currentUser.following) currentUser.following = [];
        if (!targetUser.followers) targetUser.followers = [];

        if (!currentUser.isFollowing(targetUserId)) {
            await session.abortTransaction();
            return res.status(400).json({
                status: 'error',
                code: 'NOT_FOLLOWING',
                message: 'You are not following this user'
            });
        }

        currentUser.following = currentUser.following.filter(
            id => id.toString() !== targetUserId
        );
        await currentUser.save({ session });

        targetUser.followers = targetUser.followers.filter(
            id => id.toString() !== currentUserId
        );
        await targetUser.save({ session });

        await session.commitTransaction();

        res.status(200).json({
            message: `You have unfollowed ${targetUser.username}`,
            followerStats: {
                followersCount: targetUser.followers.length,
                followingCount: currentUser.following.length
            }
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error unfollowing user'
        });
    } finally {
        session.endSession();
    }
});

// ========== GET /api/users/:userId/followers - Get user's followers ==========
router.get('/:userId/followers', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

        // Validate ID
        if (!userId || userId.length !== 24) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_USER_ID',
                message: 'Invalid user ID format'
            });
        }

        // Get user and populate followers
        const user = await User.findById(userId)
            .populate({
                path: 'followers',
                select: 'username avatar stats',
            });

        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        // Ensure followers array exists (for old documents without this field)
        if (!user.followers) {
            user.followers = [];
        }

        // Get total follower count
        const totalFollowers = user.followers.length;

        // Apply pagination manually
        const paginatedFollowers = user.followers.slice(skip, skip + limit);

        // Format follower data with isFollowing indicator
        const { userId: currentUserId } = req.user;
        const currentUser = await User.findById(currentUserId);

        // Ensure currentUser exists and has following array
        if (!currentUser) {
            return res.status(404).json({
                status: 'error',
                code: 'CURRENT_USER_NOT_FOUND',
                message: 'Current user not found'
            });
        }

        if (!currentUser.following) {
            currentUser.following = [];
        }

        const followersList = paginatedFollowers.map(follower => ({
            ...follower.toPublicJSON(),
            isFollowedByYou: currentUser.isFollowing(follower._id)
        }));

        res.json({
            message: `${user.username}'s followers`,
            user: {
                id: user._id,
                username: user.username,
                avatar: user.avatar
            },
            pagination: {
                page,
                limit,
                total: totalFollowers,
                pages: Math.ceil(totalFollowers / limit)
            },
            count: followersList.length,
            followers: followersList
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error retrieving followers'
        });
    }
});
// ========== GET /api/users/:userId/following - Get who user is following ==========
router.get('/:userId/following', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

        // Validate ID
        if (!userId || userId.length !== 24) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_USER_ID',
                message: 'Invalid user ID format'
            });
        }

        // Get user and populate following
        const user = await User.findById(userId)
            .populate({
                path: 'following',
                select: 'username avatar stats',
            });

        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        // Ensure following array exists (for old documents without this field)
        if (!user.following) {
            user.following = [];
        }

        // Get total following count
        const totalFollowing = user.following.length;

        // Apply pagination manually
        const paginatedFollowing = user.following.slice(skip, skip + limit);

        // Format following data with isFollowing indicator
        const { userId: currentUserId } = req.user;
        const currentUser = await User.findById(currentUserId);

        // Ensure currentUser exists and has following array
        if (!currentUser) {
            return res.status(404).json({
                status: 'error',
                code: 'CURRENT_USER_NOT_FOUND',
                message: 'Current user not found'
            });
        }

        if (!currentUser.following) {
            currentUser.following = [];
        }

        const followingList = paginatedFollowing.map(followedUser => ({
            ...followedUser.toPublicJSON(),
            isFollowedByYou: currentUser.isFollowing(followedUser._id)
        }));

        res.json({
            message: `${user.username} is following`,
            user: {
                id: user._id,
                username: user.username,
                avatar: user.avatar
            },
            pagination: {
                page,
                limit,
                total: totalFollowing,
                pages: Math.ceil(totalFollowing / limit)
            },
            count: followingList.length,
            following: followingList
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error retrieving following list'
        });
    }
});

// ========== GET /api/users/:userId/activities - Get a user's activities ==========
// Coordinates are stripped based on the target user's activityPrivacy setting:
//   public    → coordinates visible to everyone
//   followers → coordinates visible only to followers (default)
//   private   → coordinates never returned to anyone except the owner
router.get('/:userId/activities', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const requesterId = req.user.userId;

        if (!userId || userId.length !== 24) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_USER_ID',
                message: 'Invalid user ID format'
            });
        }

        const user = await User.findById(userId).select('username activityPrivacy followers');
        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        const isOwner = userId === requesterId;
        const isFollower = user.followers?.some(id => id.toString() === requesterId);
        const privacy = user.activityPrivacy || 'followers';

        // Determine whether requester can see coordinates
        const canSeeCoordinates =
            isOwner ||
            privacy === 'public' ||
            (privacy === 'followers' && isFollower);

        // If private and not owner, return no activities at all
        if (privacy === 'private' && !isOwner) {
            return res.json({
                message: 'Activities retrieved successfully',
                count: 0,
                activities: [],
                privacy: 'private'
            });
        }

        const activities = await Activity.find({ userId })
            .sort({ createdAt: -1 })
            .limit(50)
            .select('activityType distance duration elevationGain stolenHexagons capturedHexagons estimatedCalories coordinates kudosCount commentCount createdAt')
            .lean();

        const formatted = activities.map(a => ({
            ...a,
            username: user.username,
            kudosCount: a.kudosCount ?? 0,
            commentCount: a.commentCount ?? 0,
            // Strip coordinates if requester doesn't have permission
            coordinates: canSeeCoordinates ? a.coordinates : undefined,
        }));

        res.json({
            message: 'Activities retrieved successfully',
            count: formatted.length,
            activities: formatted,
        });

    } catch (err) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error retrieving activities'
        });
    }
});

// ========== GET /api/users/:userId - Get user profile (public) ==========
router.get('/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { userId: currentUserId } = req.user;

        // Validate ID
        if (!userId || userId.length !== 24) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_USER_ID',
                message: 'Invalid user ID format'
            });
        }

        // Get user + live tile count in parallel
        const Territory = require('../models/territory');
        const [user, currentUser, tilesOwned] = await Promise.all([
            User.findById(userId),
            User.findById(currentUserId),
            Territory.countDocuments({ ownerId: userId }),
        ]);

        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        if (!currentUser) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'Current user not found'
            });
        }

        if (!currentUser.following) currentUser.following = [];

        const isFollowing = currentUser.isFollowing(userId);

        res.json({
            message: 'User profile retrieved',
            user: { ...user.toPublicJSON(), tilesOwned },
            relationshipStatus: {
                isFollowing,
                followerCount: user.followers.length,
                followingCount: user.following.length
            }
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error retrieving user profile'
        });
    }
});

module.exports = router;