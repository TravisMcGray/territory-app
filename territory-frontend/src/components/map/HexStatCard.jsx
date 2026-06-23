// ========== HEXAGON STAT CARD ==========
// Flies in and docks at the top-right for any tapped hex (a tile or a rival's
// shield). A consistent spot keeps it out of the way (it never covers the tiles
// the way the old on-map popup did) and reads calmly on a screen recording.
// This is the single unified card: it explains the height-by-capture-count
// language, and for a rival's hex it folds in who owns it (name -> profile,
// their highest capture) plus a fly-to-territory action, so there is no separate
// player card to collide with.

import { getTierColor } from '../../utils/mapHelpers';

// Captures at or above this count sit in the top tier; the progress read is
// "how close to peak." Matches the tier bands used across the map.
const PEAK_CAPTURES = 10;

const tierName = (c) => (c >= 10 ? 'Tier 4' : c >= 7 ? 'Tier 3' : c >= 4 ? 'Tier 2' : 'Tier 1');

export default function HexStatCard({ hex, onClose, onViewProfile, onFlyToTerritory }) {
    if (!hex) return null;

    const { owner, isMine, activityType, capturedAt, captureCount, player } = hex;
    const color = getTierColor(captureCount);
    const atPeak = captureCount >= PEAK_CAPTURES;
    const progress = Math.min(captureCount / PEAK_CAPTURES, 1);
    const activityLabel = activityType === 'RUN' ? '🏃 Run' : '🚶 Walk';

    // Rival hexes carry a player block. Their peak tier color reflects overall
    // strength (their best tile), separate from this hex's own tier color.
    const rival = !isMine && player;
    const playerColor = rival ? getTierColor(player.maxCapture) : color;

    // Sci-fi panel: top-left and bottom-right corners cut so it reads as hex-tech
    // without clipping the text. The outer layer is the tier-colored edge.
    const clip = 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)';

    return (
        <div
            style={{
                // Top-right dock: consistent spot, never covers the tiles.
                position: 'absolute', zIndex: 10, top: 16, right: 16,
                animation: 'hexCardIn 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
                filter: `drop-shadow(0 0 18px ${color}55)`,
            }}
        >
            {/* Colored edge */}
            <div style={{ background: color, clipPath: clip, padding: 1.5 }}>
                {/* Glass body */}
                <div
                    style={{
                        clipPath: clip,
                        background: 'rgba(8, 10, 20, 0.94)',
                        backdropFilter: 'blur(16px)',
                        padding: '16px 18px 18px',
                        minWidth: 218,
                    }}
                >
                    {/* Close */}
                    <button
                        onClick={onClose}
                        style={{ position: 'absolute', top: 8, right: 14, background: 'none', border: 'none',
                            color: '#6b7280', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
                    >×</button>

                    {/* Hex emblem + owner */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <svg width="30" height="30" viewBox="0 0 40 40">
                            <path d="M20 3 L34 11 L34 29 L20 37 L6 29 L6 11 Z"
                                fill={`${color}22`} stroke={color} strokeWidth="2.5" strokeLinejoin="round"/>
                        </svg>
                        <div>
                            {rival ? (
                                <div
                                    onClick={() => onViewProfile?.(player.ownerId)}
                                    style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.2,
                                        cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                                >
                                    {owner}
                                </div>
                            ) : (
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                                    {isMine ? 'Your Hex' : owner}
                                </div>
                            )}
                            <div style={{ fontSize: 11, fontWeight: 700, color }}>
                                {activityLabel}
                            </div>
                        </div>
                    </div>

                    {/* Capture count: the big number the height encodes */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>
                            {captureCount}×
                        </span>
                        <span style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Times Captured
                        </span>
                    </div>

                    {/* Progress to peak: explains what the tower height means */}
                    <div style={{ marginTop: 12 }}>
                        <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progress * 100}%`, background: color,
                                borderRadius: 999, boxShadow: `0 0 8px ${color}`, transition: 'width 0.4s ease' }}/>
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                            {atPeak
                                ? '⛰ Peak tier reached'
                                : `Taller tower = more captures · ${captureCount} of ${PEAK_CAPTURES} to peak`}
                        </div>
                    </div>

                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 12 }}>
                        Captured {capturedAt}
                    </div>

                    {/* Rival owner: their peak and a jump-to-territory action */}
                    {rival && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {tierName(player.maxCapture)} · Max Cap
                                </span>
                                <span style={{ fontSize: 18, fontWeight: 800, color: playerColor }}>
                                    {player.maxCapture}×
                                </span>
                            </div>
                            <button
                                onClick={() => onFlyToTerritory?.(player.ownerId)}
                                style={{ marginTop: 12, width: '100%', padding: '9px 0',
                                    background: `${playerColor}1f`, border: `1px solid ${playerColor}`,
                                    color: playerColor, fontWeight: 800, fontSize: 12, borderRadius: 10,
                                    cursor: 'pointer', letterSpacing: '0.02em' }}
                            >
                                Fly to their territory
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
