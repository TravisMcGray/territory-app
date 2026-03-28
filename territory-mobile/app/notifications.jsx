// ========== NOTIFICATIONS SCREEN ==========
// Shows all notifications with unread highlighting.
// Supports mark as read, mark all as read, and delete.
// Accessible from the dashboard via bell icon.

import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    getNotifications,
    markAsRead,
    markAllRead,
    deleteNotification,
} from '../services/api';
import HexBackground from '../components/HexBackground';

// ========== TIME HELPER ==========
const timeAgo = (dateString) => {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
    });
};

// ========== NOTIFICATION ICONS ==========
const getNotificationIcon = (type) => {
    switch (type) {
        case 'kudos': return '⚡';
        case 'comment': return '💬';
        case 'follow': return '👤';
        case 'achievement': return '🏆';
        case 'territory_stolen': return '⚔️';
        case 'milestone': return '🎯';
        default: return '🔔';
    }
};

// ========== MAIN COMPONENT ==========
export default function Notifications() {
    const router = useRouter();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // ========== LOAD NOTIFICATIONS ==========
    useEffect(() => {
        const load = async () => {
            try {
                const res = await getNotifications();
                setNotifications(res.data.notifications || []);
            } catch (err) {
                setError('Failed to load notifications.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // ========== MARK SINGLE AS READ ==========
    const handleMarkRead = async (id) => {
        try {
            await markAsRead(id);
            setNotifications(prev =>
                prev.map(n => n._id === id ? { ...n, read: true } : n)
            );
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    };

    // ========== MARK ALL AS READ ==========
    const handleMarkAllRead = async () => {
        try {
            await markAllRead();
            setNotifications(prev =>
                prev.map(n => ({ ...n, read: true }))
            );
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };

    // ========== DELETE NOTIFICATION ==========
    const handleDelete = (id) => {
        Alert.alert('Delete Notification', 'Remove this notification?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteNotification(id);
                        setNotifications(prev => prev.filter(n => n._id !== id));
                    } catch (err) {
                        console.error('Failed to delete notification:', err);
                    }
                },
            },
        ]);
    };

    // ========== HANDLE TAP (navigate + mark read) ==========
    const handleTap = async (notification) => {
        // Mark as read if unread
        if (!notification.read) {
            handleMarkRead(notification.id);
        }

        // Navigate based on notification type
        const type = notification.type;
        const data = notification.data || {};

        if (type === 'follow' && data.fromUserId) {
            router.push(`/user/${data.fromUserId}`);
        } else if ((type === 'kudos' || type === 'comment') && data.activityId) {
            // No dedicated activity detail screen on mobile yet — stay on notifications
        } else if (type === 'achievement') {
            router.push('/(tabs)/profile');
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#10b981" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <HexBackground />
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={styles.backText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.pageTitle}>Notifications</Text>
                    <View style={{ width: 50 }} />
                </View>

                {/* Mark all read button */}
                {unreadCount > 0 && (
                    <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllButton}>
                        <Text style={styles.markAllText}>
                            Mark all as read ({unreadCount})
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Error */}
                {error !== '' && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Empty state */}
                {!error && notifications.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>🔔</Text>
                        <Text style={styles.emptyTitle}>No notifications</Text>
                        <Text style={styles.emptyText}>
                            You'll see notifications here when people interact with your activities.
                        </Text>
                    </View>
                )}

                {/* Notification list */}
                {notifications.map((notification, index) => (
                    <TouchableOpacity
                        key={notification.id ?? `notif-${index}`}
                        style={[
                            styles.notificationRow,
                            !notification.read && styles.notificationUnread,
                        ]}
                        onPress={() => handleTap(notification)}
                        onLongPress={() => handleDelete(notification.id)}
                        activeOpacity={0.7}
                    >
                        {/* Unread dot */}
                        {!notification.read && (
                            <View style={styles.unreadDot} />
                        )}

                        {/* Icon */}
                        <Text style={styles.notificationIcon}>
                            {getNotificationIcon(notification.type)}
                        </Text>

                        {/* Content */}
                        <View style={styles.notificationContent}>
                            <Text style={[
                                styles.notificationMessage,
                                !notification.read && styles.notificationMessageUnread,
                            ]}>
                                {notification.message}
                            </Text>
                            <Text style={styles.notificationTime}>
                                {timeAgo(notification.createdAt)}
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))}

                {notifications.length > 0 && (
                    <Text style={styles.hintText}>
                        Long press to delete a notification
                    </Text>
                )}

                <View style={{ height: 20 }} />
            </ScrollView>
        </View>
    );
}

// ========== STYLES ==========
const styles = {
    container: { flex: 1, backgroundColor: '#030712' },
    loadingContainer: { flex: 1, backgroundColor: '#030712', justifyContent: 'center', alignItems: 'center' },
    scrollView: { flex: 1, zIndex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 20 },

    header: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 20,
    },
    backText: { color: '#10b981', fontSize: 14, fontWeight: '700' },
    pageTitle: { color: '#ffffff', fontSize: 20, fontWeight: '900' },

    markAllButton: {
        alignSelf: 'flex-end', marginBottom: 16,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)',
        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    },
    markAllText: { color: '#10b981', fontSize: 12, fontWeight: '700' },

    errorContainer: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)', borderRadius: 12, padding: 12, marginBottom: 16,
    },
    errorText: { color: '#f87171', fontSize: 13, fontWeight: '700' },

    emptyState: { alignItems: 'center', paddingVertical: 48 },
    emptyEmoji: { fontSize: 48, marginBottom: 16 },
    emptyTitle: { color: '#ffffff', fontSize: 20, fontWeight: '900', marginBottom: 8 },
    emptyText: { color: '#9ca3af', fontSize: 13, fontWeight: '700', textAlign: 'center' },

    notificationRow: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        backgroundColor: '#111827', borderRadius: 14,
        padding: 14, borderWidth: 1, borderColor: '#1f2937',
        marginBottom: 8, position: 'relative',
    },
    notificationUnread: {
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    unreadDot: {
        position: 'absolute', top: 14, left: 8,
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: '#10b981',
    },
    notificationIcon: { fontSize: 20, marginLeft: 8 },
    notificationContent: { flex: 1 },
    notificationMessage: { color: '#9ca3af', fontSize: 13, fontWeight: '700', lineHeight: 20 },
    notificationMessageUnread: { color: '#d1d5db' },
    notificationTime: { color: '#4b5563', fontSize: 11, fontWeight: '700', marginTop: 4 },

    hintText: { color: '#374151', fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 16 },
};