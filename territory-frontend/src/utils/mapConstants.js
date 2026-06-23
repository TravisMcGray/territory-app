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

// How long camera fly/zoom transitions take, in ms. Deliberately slow: a gentle
// flight reads as cinematic and gives map tiles time to load during the move,
// which avoids the white flash that fast zooms cause.
export const FLY_DURATION_MS = 3500;

// The Globe button pulls back across the whole zoom range, so it gets an even
// slower, more cinematic duration of its own. Paired with an ease-out curve, it
// reaches the globe view early (requesting those tiles) then settles slowly,
// giving the globe tiles time to load before the motion stops.
export const GLOBE_FLY_DURATION_MS = 3500;

// Skyline tilt: once zoomed in to at least PITCH_ZOOM, the camera pitches to
// SKYLINE_PITCH so the 3D extruded hexagons read as a skyline. It flattens back
// to top-down when zoomed out toward the globe.
export const PITCH_ZOOM = 14;
export const SKYLINE_PITCH = 55;

// Fraction each hexagon is shrunk toward its own center before being extruded
// into a tower, leaving a gutter between neighbors so every tower reads as its
// own graphic instead of merging into one solid mass. Applied only to the 3D
// source, never the flat fills.
export const TOWER_GAP = 0.18;

// Recency glow window, in days. A hex captured just now glows brightest and the
// bloom fades to nothing once it is this many days old, so an active week visibly
// lights up the territory. Drives the `recency` property on each hex feature.
export const RECENCY_WINDOW_DAYS = 14;
