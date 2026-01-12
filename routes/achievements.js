const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Achievement = require('../models/achievement');
const { authenticateToken } = require('../middleware/auth');

// ========== GET api/achievements - Get all achievements ==========
router.get('/', authenticateToken, async (req, res) => {
    try {
        const achievements = await Achievement.find().sort({ rarity: -1, name: 1 });

        res.json({
            message: 'All achievements retrieved',
            count: achievements.length, 
            achievements
        });

    } catch (error) {
        res.status(500).json({ 
            message: 'Error retrieving achievements',
            error: error.message
        });
    }
});

// ========== GET api/achievements/user - Get user's unlocked achievements ==========
router.get('/user', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get user with populated achievements
        const user = await User.findById(userId).populate({
                path: 'achievements.achievementId',
                select: 'name description rarity points badgeUrl',
                options: { strictPopulate: false }
        });

        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        res.json({
            message: 'User achievements retrieved',
            count: user.achievements.length,
            achievements: user.achievements
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error retrieving user achievements',
            error: error.message
        });
    }
});

// ========== GET api/achievements/:achievementId - Get specific achievement ==========
router.get('/:achievementId', authenticateToken, async (req, res) => {
    try {
        const { achievementId } = req.params;

        const achievement = await Achievement.findById(achievementId);

        if (!achievement) {
            return res.status(404).json({
                status: 'error',
                code: 'ACHIEVEMENT_NOT_FOUND',
                message: 'Achievement not found'
            });
        }

        res.json({
            message: 'Achievement retrieved',
            achievement
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error retrieving achievement',
            error: error.message
        });
    }
});

module.exports = router;