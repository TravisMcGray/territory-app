const Notification = require('../models/notification');

// ========== HELPER FUNCTIONS TO CREATE NOTIFICATIONS ==========
// These functions are called from other route handlers to trigger notifications
// Keeps notification logic centralized and maintainable

// Friend logged an activity - notify all followers
async function createFriendActivityNotification(followerIds, actorUser, activity) {
    // Build notification for each follower
    // We use insertMany for efficiency when notifying multiple users
    const notifications = followerIds.map(followerId => ({
        user: followerId,
        type: 'FRIEND_ACTIVITY',
        title: 'Friend Activity',
        message: `${actorUser.username} ${activity.activityType === 'run' ? 'ran' : 'walked'} ${activity.distance.toFixed(2)} miles and captured ${activity.hexagonsCaptured} hexagons`,
        relatedUser: actorUser._id,
        relatedActivity: activity._id
    }));

    if (notifications.length > 0) {
        await Notification.insertMany(notifications);
    }
}

// User unlocked an achievement
async function createAchievementNotification(userId, achievement) {
    await Notification.create({
        user: userId,
        type: 'ACHIEVEMENT',
        title: 'Achievement Unlocked',
        message: `You unlocked "${achievement.name}" - ${achievement.description}`,
        relatedAchievement: achievement._id
    });
}

// Territory stolen - only triggers for runner vs runner (not walker scenarios)
async function createTerritoryStolenNotification(victimUserId, thiefUser, hexagonCount) {
    await Notification.create({
        user: victimUserId,
        type: 'TERRITORY_STOLEN',
        title: 'Territory Stolen',
        message: `${thiefUser.username} stole ${hexagonCount} of your hexagons. Time to reclaim your territory!`,
        relatedUser: thiefUser._id
    });
}

// Segment record broken - notify previous record holder
async function createSegmentRecordNotification(previousRecordHolderId, newRecordHolder, segment, timeDifference) {
    await Notification.create({
        user: previousRecordHolderId,
        type: 'SEGMENT_RECORD',
        title: 'Segment Record Broken',
        message: `${newRecordHolder.username} broke your record on "${segment.name}" by ${timeDifference} seconds!`,
        relatedUser: newRecordHolder._id,
        relatedSegment: segment._id
    });
}

// New follower - notify the user being followed
async function createNewFollowerNotification(followedUserId, followerUser) {
    await Notification.create({
        user: followedUserId,
        type: 'NEW_FOLLOWER',
        title: 'New Follower',
        message: `${followerUser.username} started following you`,
        relatedUser: followerUser._id
    });
}

// Activity comment - notify activity owner (add to existing exports)
async function createActivityCommentNotification(activityOwnerId, commenterUser, activity) {
    // Don't notify if user commented on their own activity
    if (activityOwnerId.toString() === commenterUser._id.toString()) {
        return;
    }
    
    await Notification.create({
        user: activityOwnerId,
        type: 'COMMENT',
        title: 'New Comment',
        message: `${commenterUser.username} commented on your ${activity.activityType}`,
        relatedUser: commenterUser._id,
        relatedActivity: activity._id
    });
}

module.exports = {
    createFriendActivityNotification,
    createAchievementNotification,
    createTerritoryStolenNotification,
    createSegmentRecordNotification,
    createNewFollowerNotification,
    createActivityCommentNotification
};