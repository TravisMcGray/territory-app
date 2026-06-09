// ========== STARTING LOCATION PROMPT ==========
// Shown after a searched address is previewed on the map. The address is only
// saved as the user's Home pin if they confirm here, so previewing a location
// (for example during a demo) never silently reveals or stores it.

export default function StartingLocationPrompt({ location, onConfirm, onDismiss }) {
    if (!location) return null;

    return (
        <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 15, background: 'rgba(10,10,20,0.94)', backdropFilter: 'blur(16px)',
            border: '1.5px solid rgba(16,185,129,0.4)', borderRadius: 16,
            padding: '14px 18px', maxWidth: 340, width: 'calc(100% - 32px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', animation: 'fadeSlideUp 0.25s ease',
        }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: location.label ? 2 : 12 }}>
                Set this as your starting location?
            </div>
            {location.label && (
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {location.label}
                </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
                <button
                    onClick={onConfirm}
                    style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                    Yes, set as home
                </button>
                <button
                    onClick={onDismiss}
                    style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #374151', borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                    Not now
                </button>
            </div>
        </div>
    );
}
