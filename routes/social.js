const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { authenticateToken } = require('../middleware/auth');

// ========== POST /api/users/:userId/follow - Follow a user ==========
router.post('/:userId/follow', authenticateToken, async (req, res) => {
    try {
        const { userId: currentUserId } = req.user;
        const { userId: targetUserId } = req.params;

        // Validate IDs
        if (!targetUserId || targetUserId.length !== 24) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_USER_ID',
                message: 'Invalid user ID format'
            });
        }

        // Can't follow yourself
        if (currentUserId === targetUserId) {
            return res.status(400).json({
                status: 'error',
                code: 'CANNOT_FOLLOW_SELF',
                message: 'You cannot follow yourself'
            });
        }

        // Get current user and target user
        const currentUser = await User.findById(currentUserId);
        const targetUser = await User.findById(targetUserId);

        // Ensure arrays exist (for old documents without these fields)
        if (!currentUser.following) {
            currentUser.following = [];
        }
        if (!targetUser.followers) {
            targetUser.followers = [];
        }

        // Check if target user exists
        if (!targetUser) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        // Check if already following
        if (currentUser.isFollowing(targetUserId)) {
            return res.status(400).json({
                status: 'error',
                code: 'ALREADY_FOLLOWING',
                message: 'You are already following this user'
            });
        }

        // Add to current user's following list
        currentUser.following.push(targetUserId);
        await currentUser.save();

        // Add to target user's followers list
        targetUser.followers.push(currentUserId);
        await targetUser.save();

        res.status(200).json({
            message: `You are now following ${targetUser.username}`,
            followingUser: targetUser.toPublicJSON(),
            followerStats: {
                followersCount: targetUser.followers.length,
                followingCount: currentUser.following.length
            }
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error following user',
            error: error.message
        });
    }
});

// ========== DELETE /api/users/:userId/follow - Unfollow a user ==========
router.delete('/:userId/follow', authenticateToken, async (req, res) => {
    try {
        const { userId: currentUserId } = req.user;
        const { userId: targetUserId } = req.params;

        // Validate IDs
        if (!targetUserId || targetUserId.length !== 24) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_USER_ID',
                message: 'Invalid user ID format'
            });
        }

        // Get current user and target user
        const currentUser = await User.findById(currentUserId);
        const targetUser = await User.findById(targetUserId);

        // Ensure arrays exist (for old documents without these fields)
        if (!currentUser.following) {
            currentUser.following = [];
        }
        if (!targetUser.followers) {
            targetUser.followers = [];
        }

        // Check if target user exists
        if (!targetUser) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        // Check if following
        if (!currentUser.isFollowing(targetUserId)) {
            return res.status(400).json({
                status: 'error',
                code: 'NOT_FOLLOWING',
                message: 'You are not following this user'
            });
        }

        // Remove from current user's following list
        currentUser.following = currentUser.following.filter(
            id => id.toString() !== targetUserId
        );
        await currentUser.save();

        // Remove from target user's followers list
        targetUser.followers = targetUser.followers.filter(
            id => id.toString() !== currentUserId
        );
        await targetUser.save();

        res.status(200).json({
            message: `You have unfollowed ${targetUser.username}`,
            followerStats: {
                followersCount: targetUser.followers.length,
                followingCount: currentUser.following.length
            }
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error unfollowing user',
            error: error.message
        });
    }
});

// ========== GET /api/users/:userId/followers - Get user's followers ==========
router.get('/:userId/followers', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

        console.log('1. Got request for user:', userId);

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

        console.log('2. Found user:', user?.username, 'followers type:', typeof user?.followers);

        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        // Ensure followers array exists (for old documents without this field)
        if (!user.followers) {
            console.log('3. Initializing followers array');
            user.followers = [];
        }

        console.log('4. About to get totalFollowers, user.followers is:', Array.isArray(user.followers));
        // Get total follower count
        const totalFollowers = user.followers.length;
        console.log('5. totalFollowers:', totalFollowers);

        // Apply pagination manually
        const paginatedFollowers = user.followers.slice(skip, skip + limit);

        // Format follower data with isFollowing indicator
        const { userId: currentUserId } = req.user;
        const currentUser = await User.findById(currentUserId);

        console.log('6. currentUser found:', !!currentUser);

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

        console.log('7. About to map followers');
        const followersList = paginatedFollowers.map(follower => ({
            ...follower.toPublicJSON(),
            isFollowedByYou: currentUser.isFollowing(follower._id)
        }));

        console.log('8. Sending response');
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
        console.error('ERROR:', error);
        res.status(500).json({
            message: 'Error retrieving followers',
            error: error.message
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
            message: 'Error retrieving following list',
            error: error.message
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

        // Get user
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        // Check if current user is following this user
        const currentUser = await User.findById(currentUserId);

        // Ensure currentUser has following array
        if (!currentUser.following) {
            currentUser.following = [];
        }

        const isFollowing = currentUser.isFollowing(userId);

        res.json({
            message: 'User profile retrieved',
            user: user.toPublicJSON(),
            relationshipStatus: {
                isFollowing,
                followerCount: user.followers.length,
                followingCount: user.following.length
            }
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error retrieving user profile',
            error: error.message
        });
    }
});

module.exports = router;