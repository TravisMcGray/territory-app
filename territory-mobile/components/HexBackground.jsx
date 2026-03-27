// ========== HEX BACKGROUND (REACT NATIVE) ==========
// Decorative hexagon grid background — same visual as web HexBackground.jsx.
// Uses react-native-svg instead of HTML SVG elements.
// Renders a grid of hexagons with emerald → blue → purple gradient,
// fading out on the right and bottom edges.
//
// NOTE: This is purely decorative — NOT the game map.

import { View, Dimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, G, Polygon } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const HEX_SIZE = 20;
const HEX_HEIGHT = Math.sqrt(3) * HEX_SIZE;
const COL_SPACING = HEX_SIZE * 2 * 0.75;
const ROW_SPACING = HEX_HEIGHT;

// Calculate grid to fill screen
const COLS = Math.ceil(SCREEN_WIDTH / COL_SPACING) + 2;
const ROWS = Math.ceil(SCREEN_HEIGHT / ROW_SPACING) + 2;
const GRID_WIDTH = COLS * COL_SPACING + HEX_SIZE;

// Pre-calculate hexagon points for a given center
const hexPoints = (cx, cy) => {
    return Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 180) * (60 * i);
        return `${cx + HEX_SIZE * Math.cos(angle)},${cy + HEX_SIZE * Math.sin(angle)}`;
    }).join(' ');
};

// Stroke width tapers from left (thick) to right (thin)
const getStrokeWidth = (cx) => {
    const progress = cx / GRID_WIDTH;
    const maxStroke = 2.5;
    const minStroke = 0.3;
    return (maxStroke - (maxStroke - minStroke) * progress).toFixed(2);
};

// Pre-build hexagon data array (calculated once, not on every render)
const hexagons = [];
for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
        const cx = col * COL_SPACING + HEX_SIZE;
        const cy = row * ROW_SPACING + (col % 2 === 1 ? HEX_HEIGHT / 2 : 0) - HEX_HEIGHT / 2;
        hexagons.push({ cx, cy, key: `${col}-${row}` });
    }
}

export default function HexBackground() {
    return (
        <View
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: SCREEN_WIDTH,
                height: SCREEN_HEIGHT,
                zIndex: 0,
            }}
            pointerEvents="none"
        >
            {/* ========== SVG HEXAGON GRID ========== */}
            <Svg
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                style={{ position: 'absolute', top: 0, left: 0 }}
            >
                <Defs>
                    <LinearGradient
                        id="hexColor"
                        gradientUnits="userSpaceOnUse"
                        x1="0" y1="0"
                        x2={String(SCREEN_WIDTH * 0.8)} y2="0"
                    >
                        <Stop offset="0%" stopColor="#34d399" />
                        <Stop offset="10%" stopColor="#34d399" />
                        <Stop offset="40%" stopColor="#60a5fa" />
                        <Stop offset="60%" stopColor="#60a5fa" />
                        <Stop offset="75%" stopColor="#a78bfa" />
                        <Stop offset="100%" stopColor="#a78bfa" />
                    </LinearGradient>
                </Defs>

                <G
                    stroke="url(#hexColor)"
                    fill="none"
                    opacity="0.45"
                >
                    {hexagons.map(({ cx, cy, key }) => (
                        <Polygon
                            key={key}
                            points={hexPoints(cx, cy)}
                            strokeWidth={getStrokeWidth(cx)}
                        />
                    ))}
                </G>
            </Svg>

            {/* ========== RIGHT FADE OVERLAY ==========
                Fades hexagons from visible on the left to background color on the right.
                React Native doesn't support CSS linear-gradient on Views,
                so we use multiple semi-transparent strips to simulate the fade. */}
            {[...Array(10)].map((_, i) => {
                const startPercent = 30;
                const stripWidth = (100 - startPercent) / 10;
                const left = startPercent + (i * stripWidth);
                const opacity = (i + 1) / 10;

                return (
                    <View
                        key={`right-fade-${i}`}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: `${left}%`,
                            width: `${stripWidth + 1}%`,
                            height: '100%',
                            backgroundColor: '#030712',
                            opacity,
                        }}
                    />
                );
            })}

            {/* ========== BOTTOM FADE OVERLAY ==========
                Fades hexagons out at the bottom of the screen. */}
            {[...Array(8)].map((_, i) => {
                const startPercent = 65;
                const stripHeight = (100 - startPercent) / 8;
                const top = startPercent + (i * stripHeight);
                const opacity = (i + 1) / 8;

                return (
                    <View
                        key={`bottom-fade-${i}`}
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: `${top}%`,
                            width: '100%',
                            height: `${stripHeight + 1}%`,
                            backgroundColor: '#030712',
                            opacity,
                        }}
                    />
                );
            })}
        </View>
    );
}