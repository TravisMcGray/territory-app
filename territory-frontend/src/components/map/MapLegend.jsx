// ========== MAP LEGEND ==========
// The single-row legend above the map: your tile count, others' tile count, and
// the "open" (uncaptured) marker. Display only; takes the tile counts as a prop.

export default function MapLegend({ tileCount }) {
    return (
        <div className="mb-2">
            {/* Legend: title on left, counts on right */}
            <div className="w-full flex items-center bg-gray-900/80 backdrop-blur border border-gray-700/60 rounded-2xl px-3 py-1.5 shadow-lg">
                {/* Title: hidden on mobile to give legend items room */}
                <div className="hidden sm:flex flex-col leading-tight mr-4 shrink-0">
                    <span className="text-sm font-bold text-white">Territory Map</span>
                </div>
                <div className="hidden sm:block w-px h-7 bg-gray-700 shrink-0 mr-4"/>
                {/* Yours */}
                <div className="flex flex-1 items-center justify-center gap-1.5">
                    <svg width="32" height="32" viewBox="-15 -15 130 130">
                        <defs>
                            <filter id="hex-outer-glow" x="-60%" y="-60%" width="220%" height="220%">
                                <feGaussianBlur stdDeviation="6" result="blur"/>
                                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                        </defs>
                        <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
                            fill="none" stroke="#39ff14" strokeWidth="14"
                            filter="url(#hex-outer-glow)" opacity="0.5"/>
                        <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
                            fill="rgba(57,255,20,0.18)" stroke="none"/>
                        <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
                            fill="none" stroke="#39ff14" strokeWidth="7"/>
                        <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
                            fill="none" stroke="#ffffff" strokeWidth="2.5"/>
                    </svg>
                    <div className="flex flex-col leading-tight">
                        <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Yours</span>
                        <span className="text-sm font-bold text-white">{tileCount.mine}</span>
                    </div>
                </div>
                <div className="w-px h-7 bg-gray-700 shrink-0"/>
                {/* Others */}
                <div className="flex flex-1 items-center justify-center gap-1.5">
                    <svg width="26" height="26" viewBox="0 0 64 64">
                        <defs>
                            <filter id="shield-legend-glow" x="-40%" y="-40%" width="180%" height="180%">
                                <feGaussianBlur stdDeviation="2.5" result="blur"/>
                                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                        </defs>
                        <path d="M32,4 L56,12 L56,34 Q56,54 32,62 Q8,54 8,34 L8,12 Z"
                            fill="#111827" stroke="#FFD700" strokeWidth="3.5"
                            filter="url(#shield-legend-glow)"/>
                        <path d="M32,11 L50,17 L50,34 Q50,49 32,56 Q14,49 14,34 L14,17 Z"
                            fill="none" stroke="#FFD700" strokeWidth="1.5" strokeOpacity="0.5"/>
                    </svg>
                    <div className="flex flex-col leading-tight">
                        <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Others</span>
                        <span className="text-sm font-bold text-white">{tileCount.total - tileCount.mine}</span>
                    </div>
                </div>
                <div className="w-px h-7 bg-gray-700 shrink-0"/>
                {/* Uncaptured */}
                <div className="flex flex-1 items-center justify-center gap-1.5">
                    <svg width="32" height="32" viewBox="-15 -15 130 130">
                        <defs>
                            <linearGradient id="rainbow-legend" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%"   stopColor="#ff0080"/>
                                <stop offset="25%"  stopColor="#ff6600"/>
                                <stop offset="50%"  stopColor="#39ff14"/>
                                <stop offset="75%"  stopColor="#00ccff"/>
                                <stop offset="100%" stopColor="#a855f7"/>
                            </linearGradient>
                        </defs>
                        <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
                            fill="rgba(168,85,247,0.08)" stroke="none"/>
                        <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
                            fill="none" stroke="url(#rainbow-legend)" strokeWidth="7"/>
                        <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
                            fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"/>
                    </svg>
                    <div className="flex flex-col leading-tight">
                        <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Open</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
