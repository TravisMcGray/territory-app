// ========== TERRITORY GEOJSON BUILDERS ==========
// Pure transforms from raw territory records into the GeoJSON shapes MapLibre
// renders. No React, no map instance: just data in, GeoJSON out. Kept here so
// the map component stays focused on wiring rather than data munging.

import { cellToBoundary, cellToLatLng, cellsToMultiPolygon } from 'h3-js';

// Build the polygon FeatureCollection for all territory hexes, plus the
// ownership stats the map needs (how many are mine, my highest capture count,
// and the list of my hex ids for the hull).
export function buildTerritoryFeatures(territories, currentUserId) {
    let mineCount = 0;
    let myMaxCaptureCount = 1;
    const features = [];
    const myHexIds = [];

    territories.forEach((territory) => {
        const isMine = territory.owner?.id?.toString() === currentUserId;
        if (isMine) { mineCount++; myHexIds.push(territory.hexagonId); }
        if (isMine && (territory.captureCount ?? 1) > myMaxCaptureCount) myMaxCaptureCount = territory.captureCount ?? 1;

        let boundary;
        try {
            boundary = cellToBoundary(territory.hexagonId);
        } catch {
            // Skip malformed H3 indices rather than crashing the whole map
            console.warn('Invalid H3 index:', territory.hexagonId);
            return;
        }

        // CRITICAL: h3-js cellToBoundary returns [[lat, lng], ...] but GeoJSON
        // requires [lng, lat]. Flipping these is the single most common mapping
        // bug: hexes render in the ocean.
        const coordinates = boundary.map(([lat, lng]) => [lng, lat]);
        // GeoJSON polygon rings MUST be closed (first point = last point)
        coordinates.push(coordinates[0]);

        const capturedDate = territory.capturedAt
            ? new Date(territory.capturedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            })
            : 'Unknown';

        features.push({
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [coordinates],
            },
            properties: {
                isMine,
                owner: territory.owner?.username ?? 'Unknown',
                ownerId: territory.owner?.id,
                activityType: territory.activityType,
                capturedAt: capturedDate,
                captureCount: territory.captureCount ?? 1,
            },
        });
    });

    return {
        geojson: { type: 'FeatureCollection', features },
        mineCount,
        myMaxCaptureCount,
        myHexIds,
    };
}

// Build the point FeatureCollection for other players' shield icons, placed at
// the exact H3 cell centers. Only includes hexes that are not the current user's.
export function buildShieldFeatures(territories, currentUserId) {
    const features = territories
        .filter(t => t.owner?.id?.toString() !== currentUserId)
        .reduce((acc, t) => {
            try {
                const [lat, lng] = cellToLatLng(t.hexagonId);
                acc.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [lng, lat] },
                    properties: {
                        captureCount: t.captureCount ?? 1,
                        ownerId: t.owner?.id?.toString() ?? '',
                        ownerUsername: t.owner?.username ?? 'Unknown',
                    },
                });
            } catch { /* skip invalid hex */ }
            return acc;
        }, []);
    return { type: 'FeatureCollection', features };
}

// Build the merged outer-boundary (hull) Feature for a set of hex ids. May throw
// if h3-js cannot merge the cells, so callers should wrap it in try/catch.
export function buildHullGeoJSON(myHexIds) {
    const clusters = cellsToMultiPolygon(myHexIds);
    const hullCoords = clusters.map(polygon =>
        polygon.map(ring => {
            const coords = ring.map(([lat, lng]) => [lng, lat]);
            // Ensure ring is closed
            if (coords[0][0] !== coords[coords.length - 1][0] ||
                coords[0][1] !== coords[coords.length - 1][1]) {
                coords.push(coords[0]);
            }
            return coords;
        })
    );

    return {
        type: 'Feature',
        geometry: { type: 'MultiPolygon', coordinates: hullCoords },
        properties: {},
    };
}
