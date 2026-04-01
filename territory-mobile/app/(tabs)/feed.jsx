// ========== FEED SCREEN ==========
// Shows activities from users you follow.
// Supports kudos toggling with optimistic UI and inline comments.
// Matches web Feed.jsx functionality.

import { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import {
    getFeed,
    addKudos,
    removeKudos,
    addComment,
    getActivity,
} from '../../services/api';
import HexBackground from '../../components/HexBackground';

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

// ========== MAIN COMPONENT ==========
export default function Feed() {
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const currentUserId = (user?.id ?? user?._id)?.toString();

    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // ========== LOAD FEED ==========
    useFocusEffect(
        useCallback(() => {
            const loadFeed = async () => {
                try {
                    const res = await getFeed();
                    setActivities(res.data.activities || []);
                } catch (err) {
                    setError('Failed to load feed. Please try again.');
                } finally {
                    setLoading(false);
                }
            };
            loadFeed();
        }, [])
    );

    // ========== KUDOS HANDLER ==========
    const handleKudos = async (activityId, hasGivenKudos) => {
        const previous = activities;
        setActivities(prev =>
            prev.map(a => {
                if (a._id !== activityId) return a;
                return {
                    ...a,
                    hasGivenKudos: !hasGivenKudos,
                    kudosCount: hasGivenKudos ? a.kudosCount - 1 : a.kudosCount + 1,
                };
            })
        );
        try {
            if (hasGivenKudos) {
                await removeKudos(activityId);
            } else {
                await addKudos(activityId);
            }
        } catch (err) {
            setActivities(previous);
        }
    };

    // ========== COMMENT HANDLER ==========
    const handleCommentAdded = (activityId) => {
        setActivities(prev =>
            prev.map(a => {
                if (a._id !== activityId) return a;
                return { ...a, commentCount: a.commentCount + 1 };
            })
        );
    };

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
            <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}>

                <Text style={styles.pageTitle}>Activity Feed</Text>

                {/* Error */}
                {error !== '' && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Empty state */}
                {!error && activities.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>🗺️</Text>
                        <Text style={styles.emptyTitle}>Your feed is empty</Text>
                        <Text style={styles.emptyText}>
                            Your feed shows activities from people you follow.
                        </Text>
                        <Text style={styles.emptyText}>
                            Head to the Leaderboard to find people to follow!
                        </Text>
                    </View>
                )}

                {/* Activity list */}
                {activities.map(activity => (
                    <ActivityCard
                        key={activity._id}
                        activity={activity}
                        currentUserId={currentUserId}
                        onKudos={handleKudos}
                        onCommentAdded={handleCommentAdded}
                        onNavigateToProfile={(userId) => {
                            if (userId === currentUserId) {
                                router.push('/profile');
                            } else {
                                router.push(`/user/${userId}`);
                            }
                        }}
                    />
                ))}

                <View style={{ height: 20 }} />
            </ScrollView>
        </View>
    );
}

// ========== ACTIVITY CARD ==========
function ActivityCard({ activity, currentUserId, onKudos, onCommentAdded, onNavigateToProfile }) {
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const isWalk = activity.activityType === 'walk';
    const isOwnActivity = activity.userId?.toString() === currentUserId;
    const distanceMiles = (activity.distance ?? 0).toFixed(2);

    const hexCount = typeof activity.capturedHexagons === 'number'
        ? activity.capturedHexagons
        : (Array.isArray(activity.capturedHexagons) ? activity.capturedHexagons.length : 0);

    const formatDuration = (seconds) => {
        if (!seconds) return '0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    // Load comments
    const handleToggleComments = async () => {
        if (!commentsOpen && comments.length === 0) {
            setCommentsLoading(true);
            try {
                const res = await getActivity(activity._id);
                setComments(res.data.social.comments || []);
            } catch (err) {
                console.error('Failed to load comments:', err);
            } finally {
                setCommentsLoading(false);
            }
        }
        setCommentsOpen(prev => !prev);
    };

    // Submit comment
    const handleSubmitComment = async () => {
        if (!commentText.trim() || submitting) return;
        setSubmitting(true);
        try {
            const res = await addComment(activity._id, { text: commentText.trim() });
            setComments(prev => [res.data.comment, ...prev]);
            setCommentText('');
            onCommentAdded(activity._id);
        } catch (err) {
            console.error('Failed to submit comment:', err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View style={styles.card}>
            {/* Header */}
            <View style={styles.cardHeader}>
                <TouchableOpacity
                    style={styles.cardUserRow}
                    onPress={() => activity.userId && onNavigateToProfile(activity.userId.toString())}
                >
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {activity.username?.[0]?.toUpperCase() ?? '?'}
                        </Text>
                    </View>
                    <View>
                        <Text style={styles.cardUsername}>{activity.username ?? 'Unknown'}</Text>
                        <Text style={styles.cardTime}>{timeAgo(activity.createdAt)}</Text>
                    </View>
                </TouchableOpacity>
                <View style={[
                    styles.typeBadge,
                    { backgroundColor: isWalk ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)' }
                ]}>
                    <Text style={[
                        styles.typeBadgeText,
                        { color: isWalk ? '#60a5fa' : '#10b981' }
                    ]}>
                        {isWalk ? '🚶 Walk' : '🏃 Run'}
                    </Text>
                </View>
            </View>

            {/* Stats */}
            <View style={styles.statsGrid}>
                <View style={styles.statPill}>
                    <Text style={styles.statPillValue}>{distanceMiles}mi</Text>
                    <Text style={styles.statPillLabel}>Distance</Text>
                </View>
                <View style={styles.statPill}>
                    <Text style={styles.statPillValue}>{formatDuration(activity.duration)}</Text>
                    <Text style={styles.statPillLabel}>Duration</Text>
                </View>
                <View style={styles.statPill}>
                    <Text style={[styles.statPillValue, { color: '#10b981' }]}>{hexCount}</Text>
                    <Text style={styles.statPillLabel}>Hexagons</Text>
                </View>
                <View style={styles.statPill}>
                    <Text style={styles.statPillValue}>{activity.estimatedCalories ?? 0}</Text>
                    <Text style={styles.statPillLabel}>kcal</Text>
                </View>
            </View>

            {/* Stolen hexagons */}
            {activity.stolenHexagons > 0 && (
                <Text style={styles.stolenText}>
                    ⚔️ Stole {activity.stolenHexagons} hexagon{activity.stolenHexagons !== 1 ? 's' : ''}
                </Text>
            )}

            {/* Social actions */}
            <View style={styles.socialRow}>
                <TouchableOpacity
                    onPress={() => !isOwnActivity && onKudos(activity._id, activity.hasGivenKudos)}
                    disabled={isOwnActivity}
                    style={styles.socialButton}
                >
                    <Text style={styles.socialIcon}>⚡</Text>
                    <Text style={[
                        styles.socialCount,
                        activity.hasGivenKudos && { color: '#10b981' },
                        isOwnActivity && { color: '#374151' },
                    ]}>
                        {activity.kudosCount ?? 0}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleToggleComments} style={styles.socialButton}>
                    <Text style={styles.socialIcon}>💬</Text>
                    <Text style={[
                        styles.socialCount,
                        commentsOpen && { color: '#ffffff' },
                    ]}>
                        {activity.commentCount ?? 0}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Comments section */}
            {commentsOpen && (
                <View style={styles.commentsSection}>
                    {/* Comment input */}
                    <View style={styles.commentInputRow}>
                        <TextInput
                            style={styles.commentInput}
                            placeholder="Add a comment..."
                            placeholderTextColor="#4b5563"
                            value={commentText}
                            onChangeText={setCommentText}
                            maxLength={500}
                        />
                        <TouchableOpacity
                            onPress={handleSubmitComment}
                            disabled={submitting || !commentText.trim()}
                            style={[styles.commentSubmit, (!commentText.trim() || submitting) && styles.commentSubmitDisabled]}
                        >
                            <Text style={styles.commentSubmitText}>
                                {submitting ? '...' : 'Post'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {commentsLoading && (
                        <Text style={styles.commentsLoadingText}>Loading comments...</Text>
                    )}

                    {!commentsLoading && comments.length === 0 && (
                        <Text style={styles.commentsEmptyText}>No comments yet. Be the first!</Text>
                    )}

                    {comments.map(comment => (
                        <View key={comment.id} style={styles.commentRow}>
                            <View style={styles.commentAvatar}>
                                <Text style={styles.commentAvatarText}>
                                    {comment.user?.username?.[0]?.toUpperCase() ?? '?'}
                                </Text>
                            </View>
                            <View style={styles.commentContent}>
                                <Text style={styles.commentUsername}>
                                    {comment.user?.username ?? 'Unknown'}
                                    <Text style={styles.commentText}> {comment.text}</Text>
                                </Text>
                                <Text style={styles.commentTime}>{timeAgo(comment.createdAt)}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

// ========== STYLES ==========
const styles = {
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#030712',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
        zIndex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    pageTitle: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 20,
    },
    errorContainer: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    errorText: {
        color: '#f87171',
        fontSize: 13,
        fontWeight: '700',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 8,
    },
    emptyText: {
        color: '#d1d5db',
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 4,
    },
    card: {
        backgroundColor: '#111827',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#1f2937',
        marginBottom: 16,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 16,
    },
    cardUserRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#1f2937',
        borderWidth: 1,
        borderColor: '#374151',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#10b981',
        fontSize: 14,
        fontWeight: '700',
    },
    cardUsername: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },
    cardTime: {
        color: '#6b7280',
        fontSize: 11,
        marginTop: 2,
    },
    typeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    typeBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    statPill: {
        flex: 1,
        backgroundColor: '#1f2937',
        borderRadius: 12,
        paddingVertical: 8,
        alignItems: 'center',
    },
    statPillValue: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    statPillLabel: {
        color: '#4b5563',
        fontSize: 10,
        marginTop: 2,
    },
    stolenText: {
        color: '#f87171',
        fontSize: 12,
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    socialRow: {
        flexDirection: 'row',
        gap: 16,
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    socialIcon: {
        fontSize: 16,
    },
    socialCount: {
        color: '#6b7280',
        fontSize: 13,
    },
    commentsSection: {
        borderTopWidth: 1,
        borderTopColor: '#1f2937',
        padding: 16,
    },
    commentInputRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    commentInput: {
        flex: 1,
        backgroundColor: '#1f2937',
        borderWidth: 1,
        borderColor: '#374151',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#ffffff',
        fontSize: 13,
    },
    commentSubmit: {
        backgroundColor: '#10b981',
        borderRadius: 12,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    commentSubmitDisabled: {
        backgroundColor: '#1f2937',
    },
    commentSubmitText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    commentsLoadingText: {
        color: '#4b5563',
        fontSize: 12,
        textAlign: 'center',
        paddingVertical: 8,
    },
    commentsEmptyText: {
        color: '#4b5563',
        fontSize: 12,
        textAlign: 'center',
        paddingVertical: 8,
    },
    commentRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    commentAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#1f2937',
        alignItems: 'center',
        justifyContent: 'center',
    },
    commentAvatarText: {
        color: '#10b981',
        fontSize: 10,
        fontWeight: '700',
    },
    commentContent: {
        flex: 1,
    },
    commentUsername: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    commentText: {
        color: '#9ca3af',
        fontWeight: '400',
    },
    commentTime: {
        color: '#4b5563',
        fontSize: 11,
        marginTop: 2,
    },
};