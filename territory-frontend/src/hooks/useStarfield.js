import { useEffect } from 'react';

// Animated twinkling starfield drawn on a canvas behind the globe. Pass the ref
// of the target <canvas>; the hook owns the animation loop and its cleanup.
export function useStarfield(canvasRef) {
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width = canvas.offsetWidth;
        const H = canvas.height = canvas.offsetHeight;

        const stars = Array.from({ length: 220 }, () => ({
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 1.4 + 0.2,
            opacity: Math.random() * 0.7 + 0.2,
            twinkleSpeed: Math.random() * 0.02 + 0.005,
            phase: Math.random() * Math.PI * 2,
        }));

        let frame;
        let t = 0;
        const draw = () => {
            ctx.clearRect(0, 0, W, H);
            t += 1;
            stars.forEach(s => {
                const alpha = s.opacity * (0.6 + 0.4 * Math.sin(t * s.twinkleSpeed + s.phase));
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.fill();
            });
            frame = requestAnimationFrame(draw);
        };
        draw();
        return () => cancelAnimationFrame(frame);
    }, [canvasRef]);
}
