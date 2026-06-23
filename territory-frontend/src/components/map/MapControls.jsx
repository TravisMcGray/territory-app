// ========== MAP CONTROLS ROW ==========
// The toolbar above the map: address search (with autocomplete), the saved
// "Home" pin chip, and the "My Location" button. Presentational: all state and
// side effects live in the parent and are passed in as props/callbacks. The
// map-touching home flyTo is handled by the parent via onGoHome.

export default function MapControls({
    showAddressInput,
    setShowAddressInput,
    addressQuery,
    setAddressQuery,
    geocoding,
    geocodeError,
    setGeocodeError,
    suggestions,
    onSearch,
    onSuggestionClick,
    pinnedLocation,
    onGoHome,
    onClearPin,
    onMyLocation,
    onZoomToGlobe,
    skylineOn,
    onToggleSkyline,
}) {
    return (
        <div className="mb-2 flex justify-between items-center gap-3">
            {/* Address search: left side */}
            <div className="flex items-center gap-2">
                {showAddressInput ? (
                    <div className="flex flex-col gap-1 relative">
                    <form onSubmit={onSearch} className="flex items-center gap-2">
                        <input
                            autoFocus
                            type="text"
                            value={addressQuery}
                            onChange={e => { setAddressQuery(e.target.value); setGeocodeError(null); }}
                            placeholder="Enter an address..."
                            className="bg-gray-900 border border-gray-700 text-white text-sm px-3 py-2 rounded-xl outline-none focus:border-emerald-500 w-56 transition-colors"
                        />
                        <button
                            type="submit"
                            disabled={geocoding}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm px-3 py-2 rounded-xl transition-colors"
                        >
                            {geocoding ? '...' : 'Go'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setShowAddressInput(false); setAddressQuery(''); setGeocodeError(null); }}
                            className="text-gray-500 hover:text-gray-300 text-sm px-2 py-2 transition-colors"
                        >
                            ✕
                        </button>
                    </form>
                    {geocodeError && <p className="text-yellow-400 text-xs font-semibold pl-1">{geocodeError}</p>}
                    {suggestions.length > 0 && (
                        <div className="absolute top-full left-0 mt-1 w-80 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl z-50">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => onSuggestionClick(s)}
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-800 border-b border-gray-800 last:border-0 transition-colors"
                                >
                                    <span className="font-semibold text-white">{s.display_name.split(',')[0]}</span>
                                    <span className="text-gray-500 text-xs block truncate">{s.display_name.split(',').slice(1).join(',').trim()}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    </div>
                ) : (
                    <button
                        onClick={() => setShowAddressInput(true)}
                        className="bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 font-bold text-sm px-3 py-2 rounded-xl transition-colors flex items-center gap-2"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <span className="hidden sm:inline">Input Address</span>
                    </button>
                )}
            </div>

            {/* Home pin chip: shown when a location is saved */}
            {pinnedLocation && !showAddressInput && (
                <div className="flex items-center bg-gray-900 border border-emerald-600/40 rounded-xl overflow-hidden shrink-0">
                    <button
                        onClick={onGoHome}
                        className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm px-3 py-2 hover:bg-gray-800 transition-colors"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                        <span className="text-xs">Home</span>
                    </button>
                    <button
                        onClick={onClearPin}
                        className="text-gray-500 hover:text-white text-xs px-2.5 py-2 border-l border-gray-700 transition-colors hover:bg-gray-800"
                    >✕</button>
                </div>
            )}

            {/* Right-side actions: 3D toggle + zoom out to globe + my location */}
            <div className="flex items-center gap-2 shrink-0">
                <button
                    onClick={onToggleSkyline}
                    title={skylineOn ? 'Hide 3D skyline' : 'Show 3D skyline'}
                    aria-pressed={skylineOn}
                    className={`border font-bold text-sm px-3 py-2 rounded-xl transition-colors flex items-center gap-2 ${
                        skylineOn
                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                            : 'bg-gray-900 hover:bg-gray-800 border-gray-700 text-gray-400'
                    }`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2 2 7l10 5 10-5-10-5z"/>
                        <path d="M2 17l10 5 10-5"/>
                        <path d="M2 12l10 5 10-5"/>
                    </svg>
                    <span className="hidden sm:inline">3D</span>
                </button>
                <button
                    onClick={onZoomToGlobe}
                    title="Zoom out to globe"
                    className="bg-gray-900 hover:bg-gray-800 border border-gray-700 text-emerald-400 font-bold text-sm px-3 py-2 rounded-xl transition-colors flex items-center gap-2"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                    <span className="hidden sm:inline">Globe</span>
                </button>
                <button
                    onClick={onMyLocation}
                    className="bg-gray-900 hover:bg-gray-800 border border-gray-700 text-emerald-400 font-bold text-sm px-3 py-2 rounded-xl transition-colors flex items-center gap-2"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <line x1="12" y1="2" x2="12" y2="6"/>
                        <line x1="12" y1="18" x2="12" y2="22"/>
                        <line x1="2" y1="12" x2="6" y2="12"/>
                        <line x1="18" y1="12" x2="22" y2="12"/>
                    </svg>
                    <span className="hidden sm:inline">My Location</span>
                </button>
            </div>
        </div>
    );
}
