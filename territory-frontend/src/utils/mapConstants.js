// ========== MAP CONSTANTS ==========
// Shared configuration for the territory map. Colors are chosen for outdoor
// visibility and instant ownership recognition: emerald is yours, neon purple
// is theirs, no ambiguity.

// Ownership colors used in the tile popup.
export const COLOR_MINE = '#10b981';   // emerald = yours
export const COLOR_THEIRS = '#e879f9'; // neon purple = theirs

// Camera and geo defaults.
export const DEFAULT_ZOOM = 14;
export const H3_RESOLUTION = 10;
export const HEX_GRID_RING_SIZE = 5;

// Desktop IP geolocation can be off by miles. A reported accuracy at or above
// this many meters is treated as too coarse to fly the camera to.
export const ACCURACY_THRESHOLD_M = 500;
