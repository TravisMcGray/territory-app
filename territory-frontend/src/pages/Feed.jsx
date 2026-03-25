// ========== FEED PAGE ==========
// Shows activities from users you follow.
// Supports kudos toggling with optimistic UI and inline comments.
// Usernames are clickable and navigate to /profile/:userId.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFeed, addKudos, removeKudos, addComment } from '../services/api';
import { useAuth } from '../context/AuthContext';
import HexBackground from '../components/HexBackground';
import Navbar from '../components/Navbar';

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
        month: 'short',
        day: 'numeric',
    });
};

// ========== MAIN COMPONENT ==========
export default function Feed() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // ========== LOAD FEED ==========
    useEffect(() => {
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
    }, []);

    // ========== KUDOS HANDLER ==========
    // Optimistic update: change UI immediately, then sync with server.
    // If server fails, revert to previous state so nothing looks broken.
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

    // ========== RENDER ==========
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-emerald-400 text-lg font-semibold animate-pulse">
                    Loading feed data...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white relative">
            <HexBackground />
            <Navbar />

            <div className="max-w-lg mx-auto px-4 py-6 relative z-10">

                <h2 className="text-2xl font-black mb-6">Activity Feed</h2>

                {/* Error state */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mb-4">
                        {error}
                    </div>
                )}

                {/* Empty state */}
                {!error && activities.length === 0 && (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4">🗺️</div>
                        <h3 className="text-xl font-bold text-white mb-2">
                            Your feed is empty
                        </h3>
                        <p className="text-gray-300 text-sm max-w-sm mx-auto font-bold">
                            Your feed shows activities from people you follow.
                        </p>
                        <p className="text-gray-300 text-sm max-w-sm mx-auto mt-1 font-bold">
                            Head to the Leaderboard to find people to follow!
                        </p>
                    </div>
                )}

                {/* Activity list */}
                {activities.length > 0 && (
                    <div className="space-y-4">
                        {activities.map(activity => (
                            <ActivityCard
                                key={activity._id}
                                activity={activity}
                                currentUserId={user?._id}
                                onKudos={handleKudos}
                                onCommentAdded={handleCommentAdded}
                                onNavigateToProfile={(userId) => navigate(`/profile/${userId}`)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ========== ACTIVITY CARD ==========
function ActivityCard({ activity, currentUserId, onKudos, onCommentAdded, onNavigateToProfile }) {
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);

    const isWalk = activity.activityType === 'walk' || activity.activityType === 'WALK';

    // From the feed endpoint, userId is flat on the activity object (not nested)
    const isOwnActivity = activity.userId?.toString() === currentUserId?.toString();

    const distanceMiles = typeof activity.distance === 'number'
        ? activity.distance.toFixed(2)
        : '0.00';

    // capturedHexagons from the feed is a Number (projected via $size), not an array
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

    // ========== LOAD COMMENTS ==========
    const handleToggleComments = async () => {
        if (!commentsOpen && comments.length === 0) {
            setCommentsLoading(true);
            try {
                const { getActivity } = await import('../services/api');
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

    // ========== SUBMIT COMMENT ==========
    const handleSubmitComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim()) return;

        setSubmittingComment(true);
        try {
            const { addComment } = await import('../services/api');
            const res = await addComment(activity._id, { text: commentText.trim() });
            setComments(prev => [res.data.comment, ...prev]);
            setCommentText('');
            onCommentAdded(activity._id);
        } catch (err) {
            console.error('Failed to submit comment:', err);
        } finally {
            setSubmittingComment(false);
        }
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

            {/* Card header */}
            <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {/* Clickable avatar → profile */}
                        <button
                            type="button"
                            onClick={() => activity.userId && onNavigateToProfile(activity.userId)}
                            className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-bold text-emerald-400 flex-shrink-0 hover:border-emerald-500 transition-colors"
                        >
                            {activity.username?.[0]?.toUpperCase() ?? '?'}
                        </button>
                        <div>
                            {/* Clickable username → profile */}
                            <button
                                type="button"
                                onClick={() => activity.userId && onNavigateToProfile(activity.userId)}
                                className="font-bold text-white text-sm hover:text-emerald-400 transition-colors"
                            >
                                {activity.username ?? 'Unknown'}
                            </button>
                            <p className="text-gray-500 text-xs">
                                {timeAgo(activity.createdAt)}
                            </p>
                        </div>
                    </div>

                    {/* Activity type badge */}
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        isWalk
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                        {isWalk ? '🚶 Walk' : '🏃 Run'}
                    </span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <StatPill label="Distance" value={`${distanceMiles}mi`} />
                    <StatPill label="Duration" value={formatDuration(activity.duration)} />
                    <StatPill label="Hexagons" value={hexCount} accent="emerald" />
                    <StatPill label="Calories" value={`${activity.estimatedCalories ?? 0} kcal`} />
                </div>

                {/* Stolen hexagons */}
                {activity.stolenHexagons > 0 && (
                    <p className="text-red-400 text-xs mb-3">
                        ⚔️ Stole {activity.stolenHexagons} hexagon{activity.stolenHexagons !== 1 ? 's' : ''}
                    </p>
                )}

                {/* Social actions */}
                <div className="flex items-center gap-4 pt-1">

                    {/* Kudos button */}
                    <button
                        type="button"
                        onClick={() => !isOwnActivity && onKudos(activity._id, activity.hasGivenKudos)}
                        disabled={isOwnActivity}
                        className={`flex items-center gap-1.5 text-sm transition-colors ${
                            isOwnActivity
                                ? 'text-gray-700 cursor-default'
                                : activity.hasGivenKudos
                                ? 'text-emerald-400'
                                : 'text-gray-500 hover:text-emerald-400'
                        }`}
                    >
                        <span className="text-base">⚡</span>
                        <span>{activity.kudosCount ?? 0}</span>
                    </button>

                    {/* Comments button */}
                    <button
                        type="button"
                        onClick={handleToggleComments}
                        className={`flex items-center gap-1.5 text-sm transition-colors ${
                            commentsOpen
                                ? 'text-white'
                                : 'text-gray-500 hover:text-white'
                        }`}
                    >
                        <span className="text-base">💬</span>
                        <span>{activity.commentCount ?? 0}</span>
                    </button>
                </div>
            </div>

            {/* ========== COMMENTS SECTION ========== */}
            {commentsOpen && (
                <div className="border-t border-gray-800 px-5 py-4 space-y-4">

                    {/* Comment input */}
                    <form onSubmit={handleSubmitComment} className="flex gap-2">
                        <input
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            placeholder="Add a comment..."
                            maxLength={500}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                        <button
                            type="submit"
                            disabled={submittingComment || !commentText.trim()}
                            className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
                        >
                            {submittingComment ? '...' : 'Post'}
                        </button>
                    </form>

                    {/* Comments list */}
                    {commentsLoading && (
                        <div className="text-gray-600 text-sm text-center py-2">
                            Loading comments...
                        </div>
                    )}

                    {!commentsLoading && comments.length === 0 && (
                        <p className="text-gray-600 text-sm text-center py-2">
                            No comments yet. Be the first!
                        </p>
                    )}

                    {!commentsLoading && comments.length > 0 && (
                        <div className="space-y-3">
                            {comments.map(comment => (
                                <div key={comment.id} className="flex gap-2">
                                    <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-emerald-400 flex-shrink-0">
                                        {comment.user?.username?.[0]?.toUpperCase() ?? '?'}
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-white text-sm font-semibold">
                                            {comment.user?.username ?? 'Unknown'}
                                        </span>
                                        <span className="text-gray-400 text-sm ml-2">
                                            {comment.text}
                                        </span>
                                        <p className="text-gray-600 text-xs mt-0.5">
                                            {timeAgo(comment.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ========== STAT PILL ==========
function StatPill({ label, value, accent = 'white' }) {
    const colors = {
        white: 'text-white',
        emerald: 'text-emerald-400',
    };

    return (
        <div className="bg-gray-800 rounded-xl px-3 py-2 text-center">
            <div className={`text-sm font-bold ${colors[accent]}`}>{value}</div>
            <div className="text-gray-600 text-xs mt-0.5">{label}</div>
        </div>
    );
}