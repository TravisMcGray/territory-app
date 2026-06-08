import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFeed, addKudos, removeKudos } from '../services/api';
import { useAuth } from '../context/AuthContext';
import HexBackground from '../components/HexBackground';
import Navbar from '../components/Navbar';

const timeAgo = (dateString) => {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const WalkIcon = ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" fill={color}>
        <ellipse cx="28" cy="28" rx="2.2" ry="3.5" transform="rotate(-35 28 28)"/>
        <ellipse cx="20" cy="24" rx="2.2" ry="3.5" opacity="0.7" transform="rotate(-35 20 24)"/>
        <ellipse cx="22" cy="17" rx="2.2" ry="3.5" opacity="0.45" transform="rotate(-35 22 17)"/>
        <ellipse cx="14" cy="14" rx="2.2" ry="3.5" opacity="0.2" transform="rotate(-35 14 14)"/>
    </svg>
);

const RunIcon = ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" fill={color}>
        <polygon points="23,4 13,22 20,22 17,36 27,18 20,18"/>
    </svg>
);

const BoltIcon = ({ size = 16, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <polygon points="13,2 6,14 11,14 11,22 18,10 13,10"/>
    </svg>
);

const ChatIcon = ({ size = 16, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
);

const HexIcon = () => (
    <svg width="48" height="48" viewBox="0 0 100 100">
        <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
            fill="none" stroke="#cbd5e1" strokeWidth="4"/>
        <text x="50" y="57" textAnchor="middle" fontSize="28" fill="#cbd5e1" fontWeight="800">?</text>
    </svg>
);

export default function Feed() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadFeed = async () => {
            try {
                const res = await getFeed();
                setActivities(res.data.activities || []);
            } catch {
                setError('Failed to load feed. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        loadFeed();
    }, []);

    const handleKudos = async (activityId, hasGivenKudos) => {
        const previous = activities;
        setActivities(prev =>
            prev.map(a => {
                if (a._id !== activityId) return a;
                return { ...a, hasGivenKudos: !hasGivenKudos, kudosCount: hasGivenKudos ? a.kudosCount - 1 : a.kudosCount + 1 };
            })
        );
        try {
            if (hasGivenKudos) await removeKudos(activityId);
            else await addKudos(activityId);
        } catch { setActivities(previous); }
    };

    const handleCommentAdded = (activityId) => {
        setActivities(prev =>
            prev.map(a => a._id !== activityId ? a : { ...a, commentCount: a.commentCount + 1 })
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="text-emerald-500 text-lg font-semibold animate-pulse">Loading feed...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 relative">
            <style>{`
                @keyframes cardIn {
                    from { opacity: 0; transform: translateY(16px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes kudosPulse {
                    0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.7); }
                    70%  { box-shadow: 0 0 0 10px rgba(16,185,129,0); }
                    100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
                }
            `}</style>
            <HexBackground />
            <Navbar />

            <div className="max-w-lg mx-auto px-4 py-6 relative z-10">
                <h2 className="text-2xl font-black mb-6 text-slate-900">Activity Feed</h2>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-4">
                        {error}
                    </div>
                )}

                {!error && activities.length === 0 && (
                    <div className="text-center py-16">
                        <div className="flex justify-center mb-4"><HexIcon /></div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Your feed is empty</h3>
                        <p className="text-slate-500 text-sm max-w-sm mx-auto">
                            Follow people on the Leaderboard to see their activities here.
                        </p>
                    </div>
                )}

                {activities.length > 0 && (
                    <div className="space-y-4">
                        {activities.map((activity, index) => (
                            <ActivityCard
                                key={activity._id}
                                activity={activity}
                                index={index}
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

function ActivityCard({ activity, index, currentUserId, onKudos, onCommentAdded, onNavigateToProfile }) {
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);
    const [kudosBurst, setKudosBurst] = useState(false);

    const isWalk = activity.activityType === 'walk' || activity.activityType === 'WALK';
    const accentColor = isWalk ? '#3b82f6' : '#10b981';
    const isOwnActivity = activity.userId?.toString() === currentUserId?.toString();

    const distanceMiles = typeof activity.distance === 'number' ? activity.distance.toFixed(2) : '0.00';
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

    const handleKudosClick = () => {
        if (isOwnActivity) return;
        onKudos(activity._id, activity.hasGivenKudos);
        if (!activity.hasGivenKudos) {
            setKudosBurst(true);
            setTimeout(() => setKudosBurst(false), 600);
        }
    };

    const handleToggleComments = async () => {
        if (!commentsOpen && comments.length === 0) {
            setCommentsLoading(true);
            try {
                const { getActivity } = await import('../services/api');
                const res = await getActivity(activity._id);
                setComments(res.data.social.comments || []);
            } catch { /* non-fatal: comments stay empty if the load fails */ }
            finally { setCommentsLoading(false); }
        }
        setCommentsOpen(prev => !prev);
    };

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
        } catch { /* non-fatal: submit button re-enables in finally */ }
        finally { setSubmittingComment(false); }
    };

    return (
        <div style={{
            background: '#ffffff',
            border: `1px solid ${accentColor}33`,
            borderLeft: `4px solid ${accentColor}`,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: `0 2px 12px rgba(0,0,0,0.06)`,
            animation: `cardIn 0.4s ease both`,
            animationDelay: `${index * 0.06}s`,
            transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
            onMouseEnter={e => {
                e.currentTarget.style.boxShadow = `0 4px 20px ${accentColor}22`;
            }}
            onMouseLeave={e => {
                e.currentTarget.style.boxShadow = `0 2px 12px rgba(0,0,0,0.06)`;
            }}
        >
            <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => activity.userId && onNavigateToProfile(activity.userId)}
                            style={{
                                width: 40, height: 40, borderRadius: '50%',
                                background: `${accentColor}15`,
                                border: `2px solid ${accentColor}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14, fontWeight: 700, color: accentColor,
                                cursor: 'pointer', flexShrink: 0,
                                transition: 'box-shadow 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 12px ${accentColor}66`}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                        >
                            {activity.username?.[0]?.toUpperCase() ?? '?'}
                        </button>
                        <div>
                            <button
                                type="button"
                                onClick={() => activity.userId && onNavigateToProfile(activity.userId)}
                                style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.color = accentColor}
                                onMouseLeave={e => e.currentTarget.style.color = '#0f172a'}
                            >
                                {activity.username ?? 'Unknown'}
                            </button>
                            <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 1 }}>{timeAgo(activity.createdAt)}</p>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: `${accentColor}12`,
                        border: `1px solid ${accentColor}33`,
                        borderRadius: 20, padding: '5px 12px',
                    }}>
                        {isWalk ? <WalkIcon size={18} color={accentColor}/> : <RunIcon size={18} color={accentColor}/>}
                        <span style={{ fontSize: 12, fontWeight: 700, color: accentColor }}>
                            {isWalk ? 'Walk' : 'Run'}
                        </span>
                    </div>
                </div>

                {/* Hero distance */}
                <div style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 32, fontWeight: 900, color: accentColor, textShadow: `0 0 20px ${accentColor}44`, lineHeight: 1 }}>
                        {distanceMiles}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginLeft: 4 }}>mi</span>
                </div>

                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                    {[
                        { label: 'Duration', value: formatDuration(activity.duration), color: '#64748b' },
                        { label: 'Hexagons', value: hexCount, color: accentColor },
                        { label: 'Calories', value: `${activity.estimatedCalories ?? 0} kcal`, color: '#64748b' },
                    ].map((s, i) => (
                        <div key={i} style={{
                            background: i === 1 ? `${accentColor}10` : '#f8fafc',
                            border: `1px solid ${i === 1 ? accentColor + '33' : '#e2e8f0'}`,
                            borderRadius: 10, padding: '8px 6px', textAlign: 'center',
                        }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Stolen hexagons */}
                {activity.stolenHexagons > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
                        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 8, padding: '4px 10px', width: 'fit-content' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                        <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>
                            Stole {activity.stolenHexagons} hex{activity.stolenHexagons !== 1 ? 'es' : ''}
                        </span>
                    </div>
                )}

                {/* Social actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 4 }}>
                    <button
                        type="button"
                        onClick={handleKudosClick}
                        disabled={isOwnActivity}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: activity.hasGivenKudos ? `${accentColor}15` : 'transparent',
                            border: activity.hasGivenKudos ? `1px solid ${accentColor}44` : '1px solid transparent',
                            borderRadius: 20, padding: '5px 10px',
                            color: isOwnActivity ? '#cbd5e1' : activity.hasGivenKudos ? accentColor : '#94a3b8',
                            cursor: isOwnActivity ? 'default' : 'pointer',
                            fontSize: 13, fontWeight: 600,
                            transition: 'all 0.2s',
                            animation: kudosBurst ? 'kudosPulse 0.6s ease' : 'none',
                        }}
                    >
                        <BoltIcon size={18} color={isOwnActivity ? '#cbd5e1' : activity.hasGivenKudos ? accentColor : '#94a3b8'}/>
                        {activity.kudosCount ?? 0}
                    </button>

                    <button
                        type="button"
                        onClick={handleToggleComments}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: commentsOpen ? '#f1f5f9' : 'transparent',
                            border: '1px solid transparent',
                            borderRadius: 20, padding: '5px 10px',
                            color: commentsOpen ? '#0f172a' : '#94a3b8',
                            cursor: 'pointer', fontSize: 13, fontWeight: 600,
                            transition: 'all 0.2s',
                        }}
                    >
                        <ChatIcon size={18} color={commentsOpen ? '#475569' : '#94a3b8'}/>
                        {activity.commentCount ?? 0}
                    </button>
                </div>
            </div>

            {/* Comments section */}
            {commentsOpen && (
                <div style={{ borderTop: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, background: '#fafafa' }}>
                    <form onSubmit={handleSubmitComment} style={{ display: 'flex', gap: 8 }}>
                        <input
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            placeholder="Add a comment..."
                            maxLength={500}
                            style={{
                                flex: 1, background: '#ffffff', border: '1px solid #e2e8f0',
                                borderRadius: 12, padding: '8px 12px', color: '#0f172a',
                                fontSize: 13, outline: 'none', transition: 'border-color 0.2s',
                            }}
                            onFocus={e => e.target.style.borderColor = accentColor}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                        <button
                            type="submit"
                            disabled={submittingComment || !commentText.trim()}
                            style={{
                                background: accentColor, color: '#fff', fontWeight: 700,
                                fontSize: 13, padding: '8px 16px', borderRadius: 12,
                                border: 'none', cursor: 'pointer', opacity: (!commentText.trim() || submittingComment) ? 0.4 : 1,
                                transition: 'opacity 0.2s',
                            }}
                        >
                            {submittingComment ? '...' : 'Post'}
                        </button>
                    </form>

                    {commentsLoading && <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>Loading comments...</p>}
                    {!commentsLoading && comments.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>No comments yet. Be the first!</p>}
                    {!commentsLoading && comments.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {comments.map(comment => (
                                <div key={comment.id} style={{ display: 'flex', gap: 10 }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: '50%',
                                        background: `${accentColor}15`, border: `1px solid ${accentColor}33`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 11, fontWeight: 700, color: accentColor, flexShrink: 0,
                                    }}>
                                        {comment.user?.username?.[0]?.toUpperCase() ?? '?'}
                                    </div>
                                    <div>
                                        <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>{comment.user?.username ?? 'Unknown'}</span>
                                        <span style={{ color: '#475569', fontSize: 13, marginLeft: 8 }}>{comment.text}</span>
                                        <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{timeAgo(comment.createdAt)}</p>
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
