export default function HexBackground({ fadeColor = '${fadeColor}', hexOpacity = 0.45, fixed = false }) {
    const hexSize = 24;
    const hexHeight = Math.sqrt(3) * hexSize;
    const colSpacing = hexSize * 2 * 0.75;
    const rowSpacing = hexHeight;

    const cols = 48;
    const rows = 120;
    const gridWidth = cols * colSpacing + hexSize;

    const hexPoints = (cx, cy) => {
        return Array.from({ length: 6 }, (_, i) => {
            const angle = (Math.PI / 180) * (60 * i);
            return `${cx + hexSize * Math.cos(angle)},${cy + hexSize * Math.sin(angle)}`;
        }).join(' ');
    };

    const getStrokeWidth = (cx) => {
        const progress = cx / gridWidth;
        const maxStroke = 3;
        const minStroke = 0.4;
        return (maxStroke - (maxStroke - minStroke) * progress).toFixed(2);
    };

    const hexagons = [];
    for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
            const cx = col * colSpacing + hexSize;
            const cy = row * rowSpacing + (col % 2 === 1 ? hexHeight / 2 : 0) - hexHeight / 2;
            hexagons.push({ cx, cy, key: `${col}-${row}` });
        }
    }

    return (
        <div
            className={`${fixed ? 'fixed' : 'absolute'} inset-0 pointer-events-none overflow-hidden`}
            style={{ zIndex: fixed ? -1 : 0 }}
            aria-hidden="true"
        >
            <svg
                width="100%"
                height="100%"
                xmlns="http://www.w3.org/2000/svg"
                style={{ position: 'absolute', top: 0, left: 0 }}
            >
                <defs>
                    <linearGradient
                        id="hexColor"
                        gradientUnits="userSpaceOnUse"
                        x1="0" y1="0"
                        x2="900" y2="0"
                    >
                        <stop offset="0%"   stopColor="#10b981" />
                        <stop offset="10%"  stopColor="#10b981" />
                        <stop offset="40%"  stopColor="#3b82f6" />
                        <stop offset="60%"  stopColor="#3b82f6" />
                        <stop offset="75%"  stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                </defs>

                <g
                    stroke="url(#hexColor)"
                    fill="none"
                    opacity={hexOpacity}
                >
                    {hexagons.map(({ cx, cy, key }) => (
                        <polygon
                            key={key}
                            points={hexPoints(cx, cy)}
                            strokeWidth={getStrokeWidth(cx)}
                        />
                    ))}
                </g>
            </svg>

            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: `linear-gradient(to right, transparent 0%, transparent 50%, ${fadeColor} 75%, ${fadeColor} 100%)`,
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: '30%',
                    background: `linear-gradient(to bottom, transparent, ${fadeColor})`,
                }}
            />
        </div>
    );
}
