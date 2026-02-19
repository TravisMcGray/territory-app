const express = require('express');
const router = express.Router();
const Notification = require('../models/notification');
const { authenticateToken: auth } = require('../middleware/auth');

// ========== GET USER NOTIFICATIONS (Paginated) ==========
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, type, unreadOnly = false } = req.query;

        // Build filter
        const filter = { user: req.user.userId };

        if (type) {
            filter.type = type.toUpperCase();
        }

        if (unreadOnly === 'true') {
            filter.read = false;
        }

        const skip = (page -1) * limit;

        // Get notifications
        const notifications = await Notification.find(filter)
            .populate('relatedUser', 'username')
            .populate('relatedActivity', 'activityType distance')
            .populate('relatedAchievement', 'name')
            .populate('relatedSegment', 'name')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Notification.countDocuments(filter);
        const unreadCount = await Notification.countDocuments({
            user: req.user.userId,
            read: false
        });

        res.json({
            notifications: notifications.map(notif => ({
                id: notif._id,
                type: notif.type,
                title: notif.title,
                message: notif.message,
                read: notif.read,
                relatedUser: notif.relatedUser ? notif.relatedUser.username : null,
                relatedActivity: notif.relatedActivity ? {
                    type: notif.relatedActivity.activityType,
                    distance: notif.relatedActivity.distance
                } : null,
                relatedAchievement: notif.relatedAchievement ? notif.relatedAchievement.name : null,
                relatedSegment: notif.relatedSegment ? notif.relatedSegment.name : null,
                createdAt: notif.createdAt
            })),
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalNotifications: total,
            },
            unreadCount
        });

    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Server error fetching notifications' });
    }
});

// ========== MARK NOTIFICATIONS AS READ ==========
router.put('/:id/read', auth, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        // Only owner can mark as read
        if (notification.user.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Not your notification' })
        }

        notification.read = true;
        await notification.save();

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Server error updating notification' });
    }
});

// ========== MARK ALL NOTIFICATIONS AS READ ==========
router.put('/read-all', auth, async (req, res) => {
    try {
        const result = await Notification.updateMany(
            { user: req.user.userId, read: false },
            { $set: { read: true } }
        );

        res.json({
            message: 'All notifications marked as read',
            updatedCount: result.modifiedCount
        });

    } catch  (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ message: 'Server error updating notifications' });
    }
});

// ========== DELETE A NOTIFICATION ==========
router.delete('/:id', auth, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        // Only owner can delete
        if (notification.user.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Not your notification' });
        }

        await Notification.findByIdAndDelete(req.params.id);
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ message: 'Server error deleting notification' });
    }
});

// ========== GET UNREAD COUNT ==========
router.get('/unread-count', auth, async(req, res) => {
    try {
        const count = await Notification.countDocuments({
            user: req.user.userId,
            read: false
        });

        res.json({ unreadCount: count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ message: 'Server error fetching count' });
    }
});

module.exports = router;