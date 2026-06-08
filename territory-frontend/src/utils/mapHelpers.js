// ========== MAP HELPERS ==========
// Pure helper functions for the territory map. None of these touch React or the
// MapLibre instance, so they are safe to unit test and reuse anywhere.

// Deterministic color from an ownerId: the same player always gets the same
// color. The golden angle (137) keeps successive hues visually distinct.
export const playerColor = (ownerId) => {
    const hash = ownerId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hue = (hash * 137) % 360;
    return `hsl(${hue}, 100%, 62%)`;
};

// Returns a Promise that resolves to an HTMLImageElement of a colored shield,
// used as the map marker for other players' territory.
export const makeShieldImage = (color) => new Promise((resolve) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <path d="M32,4 L56,12 L56,34 Q56,54 32,62 Q8,54 8,34 L8,12 Z"
            fill="#111111" stroke="${color}" stroke-width="3.5"/>
        <path d="M32,11 L50,17 L50,34 Q50,49 32,56 Q14,49 14,34 L14,17 Z"
            fill="none" stroke="${color}" stroke-width="1.5" stroke-opacity="0.5"/>
    </svg>`;
    const img = new Image(64, 64);
    img.onload = () => resolve(img);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
});

// Convert an HSL color to a hex string. Used by the animated rainbow grid.
export function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const hex = x => Math.round(x * 255).toString(16).padStart(2, '0');
    return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

// Capture-count tier color: the visual progression ladder a tile climbs as it
// is captured more times. Green to blue to honey to pink.
export function getTierColor(count) {
    if (count >= 10) return '#ff00aa'; // T4 pink
    if (count >= 7)  return '#f5a623'; // T3 honey
    if (count >= 4)  return '#00ccff'; // T2 blue
    return '#39ff14';                  // T1 green
}
