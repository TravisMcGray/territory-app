import { useEffect } from 'react';

// After 5s idle at globe zoom, eases the camera back to the US then slowly spins
// it west to east. Poles stay fixed; only the center longitude shifts each frame.
// Any user interaction (mouse, touch, wheel, drag) resets it to idle. The spin
// is also held while a player card is open (cardOpenRef) so the globe stays put
// over the selected shield.
export function useGlobeSpin(mapRef, mapLoaded, programmaticNavRef, spinFrameRef, cardOpenRef) {
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;

        // States: 'idle' -> 'resetting' (easeTo US) -> 'spinning'; back to 'idle' on interact
        let state = 'idle';
        let lastInteraction = Date.now();
        let wasProgrammatic = false;

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
            // Pause spin during a programmatic navigation (address fly-to, globe
            // button) or while a player card is open (holding over the shield).
            if (programmaticNavRef.current) {
                wasProgrammatic = true;
            } else if (!cardOpenRef.current) {
                // A programmatic flight just finished: restart the idle countdown
                // so the lazy spin only begins once you have arrived at the globe
                // and sat still, not from the moment you clicked the button.
                if (wasProgrammatic) {
                    wasProgrammatic = false;
                    lastInteraction = Date.now();
                    state = 'idle';
                }

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
    }, [mapLoaded, mapRef, programmaticNavRef, spinFrameRef, cardOpenRef]);
}
