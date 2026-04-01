// ========== HEX BACKGROUND (REACT NATIVE — WEBVIEW) ==========
// Decorative hexagon grid background — pixel-identical to web HexBackground.jsx.
// Uses a WebView to render real HTML/SVG/CSS, which eliminates the sub-pixel
// anti-aliasing artifacts (white dots/lines) that react-native-svg produces
// when drawing adjacent polygon strokes.
//
// IMPORTANT: Uses useIsFocused() so only the ACTIVE tab's WebView renders.
// Android limits concurrent WebView rendering — without this, tabs progressively
// stop painting their WebViews as the user navigates between them.
//
// NOTE: This is purely decorative — NOT the game map.

import { View, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useIsFocused } from '@react-navigation/native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const hexHTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
  * { margin: 0; padding: 0; }
  body {
    background: #030712;
    overflow: hidden;
    width: 100vw;
    height: 100vh;
  }
  svg {
    position: absolute;
    top: 0;
    left: 0;
  }
  .fade-right {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(to right, transparent 0%, transparent 35%, #030712 55%, #030712 100%);
  }
  .fade-bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 30%;
    background: linear-gradient(to bottom, transparent, #030712);
  }
</style>
</head>
<body>
<script>
  const W = window.innerWidth;
  const H = window.innerHeight;
  const hexSize = 20;
  const hexHeight = Math.sqrt(3) * hexSize;
  const colSpacing = hexSize * 2 * 0.75;
  const rowSpacing = hexHeight;
  const cols = Math.ceil(W / colSpacing) + 2;
  const rows = Math.ceil(H / rowSpacing) + 2;
  const gridWidth = cols * colSpacing + hexSize;

  function hexPoints(cx, cy) {
    return Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 180) * (60 * i);
      return (cx + hexSize * Math.cos(angle)).toFixed(1) + ',' + (cy + hexSize * Math.sin(angle)).toFixed(1);
    }).join(' ');
  }

  let polys = '';
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const cx = col * colSpacing + hexSize;
      const cy = row * rowSpacing + (col % 2 === 1 ? hexHeight / 2 : 0) - hexHeight / 2;
      const progress = cx / gridWidth;
      const sw = (2.5 - (2.5 - 0.3) * progress).toFixed(2);
      polys += '<polygon points="' + hexPoints(cx, cy) + '" stroke-width="' + sw + '"/>';
    }
  }

  const gradX2 = (W * 0.8).toFixed(0);

  const svg = '<svg width="' + W + '" height="' + H + '" xmlns="http://www.w3.org/2000/svg">'
    + '<defs><linearGradient id="hexColor" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="' + gradX2 + '" y2="0">'
    + '<stop offset="0%" stop-color="#34d399"/>'
    + '<stop offset="10%" stop-color="#34d399"/>'
    + '<stop offset="40%" stop-color="#60a5fa"/>'
    + '<stop offset="60%" stop-color="#60a5fa"/>'
    + '<stop offset="75%" stop-color="#a78bfa"/>'
    + '<stop offset="100%" stop-color="#a78bfa"/>'
    + '</linearGradient></defs>'
    + '<g stroke="url(#hexColor)" fill="none" opacity="0.55">'
    + polys
    + '</g></svg>';

  document.body.innerHTML = svg
    + '<div class="fade-right"></div>'
    + '<div class="fade-bottom"></div>';
</script>
</body>
</html>
`;

export default function HexBackground() {
  const isFocused = useIsFocused();

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT + 50,
        zIndex: 0,
      }}
      pointerEvents="none"
    >
      {isFocused && (
        <WebView
          source={{ html: hexHTML }}
          style={{ flex: 1, backgroundColor: '#030712' }}
          scrollEnabled={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          pointerEvents="none"
          javaScriptEnabled={true}
          originWhitelist={['*']}
          bounces={false}
          scalesPageToFit={false}
          setBuiltInZoomControls={false}
        />
      )}
    </View>
  );
}