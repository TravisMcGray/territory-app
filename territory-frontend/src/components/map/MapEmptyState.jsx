// ========== MAP EMPTY STATE ==========
// Overlay shown to new users who have not captured any territory yet. Display
// only: a visibility flag and a callback to start logging an activity.

export default function MapEmptyState({ visible, onLogActivity }) {
    if (!visible) return null;

    return (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="pointer-events-auto text-center bg-gray-950/80 backdrop-blur border border-gray-700 rounded-2xl px-8 py-6 shadow-2xl max-w-xs mx-4">
                <p className="text-white font-bold text-base">No territory captured yet.</p>
                <p className="text-gray-400 font-semibold text-sm mt-1 mb-4">
                    Log your first activity to claim your first hex tiles!
                </p>
                <button
                    onClick={onLogActivity}
                    className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-6 py-2 rounded-xl transition-colors"
                >
                    Log Activity
                </button>
            </div>
        </div>
    );
}
