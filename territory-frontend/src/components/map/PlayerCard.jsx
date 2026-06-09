// ========== PLAYER PROFILE CARD ==========
// Floating card shown when a rival's shield is tapped on the map. Tapping the
// card (anywhere except the username link or close button) zooms to the player's
// territory; the username still opens their profile.

export default function PlayerCard({ player, onClose, onViewProfile, onZoomToTerritory }) {
    if (!player) return null;

    return (
        <div
            onClick={onZoomToTerritory}
            style={{
                position: 'absolute', bottom: 20, left: 20, zIndex: 10,
                background: 'rgba(10,10,20,0.92)', backdropFilter: 'blur(16px)',
                border: `1.5px solid ${player.tier.color}44`,
                borderRadius: 16, padding: '16px 18px', minWidth: 210,
                boxShadow: `0 0 24px ${player.tier.color}33`,
                animation: 'fadeSlideUp 0.25s ease', cursor: 'pointer',
            }}
        >
            {/* Close */}
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none',
                    color: '#6b7280', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
            >×</button>

            {/* Shield + username */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <svg width="32" height="32" viewBox="0 0 64 64">
                    <path d="M32,4 L56,12 L56,34 Q56,54 32,62 Q8,54 8,34 L8,12 Z"
                        fill="#111" stroke={player.tier.color} strokeWidth="3.5"/>
                    <path d="M32,11 L50,17 L50,34 Q50,49 32,56 Q14,49 14,34 L14,17 Z"
                        fill="none" stroke={player.tier.color} strokeWidth="1.5" strokeOpacity="0.5"/>
                </svg>
                <div>
                    <div
                        onClick={(e) => { e.stopPropagation(); onViewProfile(player.ownerId); }}
                        style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.2, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                    >
                        {player.username}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: player.tier.color, marginTop: 2 }}>
                        {player.tier.name}
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: player.tier.color }}>
                        {player.totalTiles}
                    </div>
                    <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Tiles
                    </div>
                </div>
                <div style={{ width: 1, background: '#2a2a3a' }}/>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: player.tier.color }}>
                        {player.maxCapture}×
                    </div>
                    <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Max Cap
                    </div>
                </div>
                <div style={{ width: 1, background: '#2a2a3a' }}/>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20 }}>
                        {player.preferredActivity === 'RUN' ? '🏃' : '🚶'}
                    </div>
                    <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {player.preferredActivity === 'RUN' ? 'Runner' : 'Walker'}
                    </div>
                </div>
            </div>

            <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 12 }}>
                Tap to fly to their territory
            </div>
        </div>
    );
}
