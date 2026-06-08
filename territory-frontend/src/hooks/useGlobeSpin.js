import { useEffect } from 'react';

// After 5s idle at globe zoom, eases the camera back to the US then slowly spins
// it west to east. Poles stay fixed; only the center longitude shifts each frame.
// Any user interaction (mouse, touch, wheel, drag) resets it to idle.
export function useGlobeSpin(mapRef, mapLoaded, programmaticNavRef, spinFrameRef) {
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;

        // States: 'idle' -> 'resetting' (easeTo US) -> 'spinning'; back to 'idle' on interact
        let state = 'idle';
        let lastInteraction = Date.now();

        const onInteract = () => {
            if (state === 'resetting') return; // ignore programmatic movement
            lastInteraction = Date.now();
            state = 'idle';
        };

        map.on('mousedown', onInteract);
        map.on('touchstart', onInteract);
        map.on('wheel', onInteract);
        map.on('dragstart', onInteract);

        map.easeTo({ bearing: 0, pitch: 0, duration: 600 });

        const spin = () => {
            // Pause spin while a programmatic navigation (address fly-to) is running
            if (!programmaticNavRef.current) {
                const idle = Date.now() - lastInteraction > 5000;
                const atGlobeZoom = map.getZoom() < 4;

                if (state === 'idle' && idle && atGlobeZoom) {
                    state = 'resetting';
                    map.easeTo({
                        center: [-98, 39],
                        zoom: 2.5,
                        bearing: 0,
                        pitch: 0,
                        duration: 2000,
                    });
                    map.once('moveend', () => {
                        if (state === 'resetting') state = 'spinning';
                    });
                } else if (state === 'spinning' && atGlobeZoom) {
                    const { lng, lat } = map.getCenter();
                    map.setCenter([(lng - 0.08 + 180) % 360 - 180, lat]);
                }
            }

            spinFrameRef.current = requestAnimationFrame(spin);
        };
        spin();

        return () => {
            cancelAnimationFrame(spinFrameRef.current);
            map.off('mousedown', onInteract);
            map.off('touchstart', onInteract);
            map.off('wheel', onInteract);
            map.off('dragstart', onInteract);
        };
    }, [mapLoaded, mapRef, programmaticNavRef, spinFrameRef]);
}
