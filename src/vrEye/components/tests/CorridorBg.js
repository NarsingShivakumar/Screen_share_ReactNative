/**
 * CorridorBg.js
 * Exact port of Angular #corridorSvg + #midLayerSvg templates.
 * Used as background in every split-eye panel (waiting, acuity, astigmatism).
 *
 * Angular renders two layers:
 *   scene-bg  (z=1): corridorSvg  + blur(5px) CSS filter
 *   scene-mid (z=2): midLayerSvg  + blur(2px) CSS filter
 * React Native has no CSS filter blur on SVG, so we approximate
 * by drawing mid-layer at lower opacity.
 */
import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Rect, Polygon, Line, Circle,
} from 'react-native-svg';

/** Angular #corridorSvg — viewBox="0 0 400 700" */
function CorridorSvg({ width, height }) {
  return (
    <Svg
      width={width} height={height}
      viewBox="0 0 400 700"
      preserveAspectRatio="xMidYMid slice"
    >
      <Rect width="400" height="700" fill="#04060e" />
      <Polygon points="0,700 400,700 200,350" fill="#090f1a" />
      <Polygon points="0,0 400,0 200,350"   fill="#060810" />
      <Polygon points="0,0 0,700 200,350"   fill="#07091a" />
      <Polygon points="400,0 400,700 200,350" fill="#07091a" />
      {/* Radiating floor lines */}
      {[0,50,100,150,200,250,300,350,400].map((x,i)=>(
        <Line key={`f${i}`} x1={x} y1="700" x2="200" y2="350"
          stroke={x===200?"#102840":"#0f2535"}
          strokeWidth={x===0||x===400||x===200?"0.6":x===100||x===300?"0.5":"0.3"} />
      ))}
      {/* Radiating ceiling lines */}
      {[0,100,200,300,400].map((x,i)=>(
        <Line key={`c${i}`} x1={x} y1="0" x2="200" y2="350"
          stroke="#0c1525"
          strokeWidth={x===0||x===200||x===400?"0.6":"0.4"} />
      ))}
      {/* Horizontal grid — floor */}
      <Line x1="100" y1="525" x2="300" y2="525" stroke="#0f2535" strokeWidth="0.6"/>
      <Line x1="150" y1="437" x2="250" y2="437" stroke="#0f2535" strokeWidth="0.5"/>
      <Line x1="175" y1="393" x2="225" y2="393" stroke="#0f2535" strokeWidth="0.4"/>
      <Line x1="188" y1="371" x2="212" y2="371" stroke="#0f2535" strokeWidth="0.3"/>
      <Line x1="194" y1="360" x2="206" y2="360" stroke="#0f2535" strokeWidth="0.2"/>
      {/* Horizontal grid — ceiling */}
      <Line x1="100" y1="175" x2="300" y2="175" stroke="#0c1525" strokeWidth="0.6"/>
      <Line x1="150" y1="262" x2="250" y2="262" stroke="#0c1525" strokeWidth="0.5"/>
      <Line x1="175" y1="306" x2="225" y2="306" stroke="#0c1525" strokeWidth="0.4"/>
      <Line x1="188" y1="328" x2="212" y2="328" stroke="#0c1525" strokeWidth="0.3"/>
      <Line x1="194" y1="339" x2="206" y2="339" stroke="#0c1525" strokeWidth="0.2"/>
      {/* Left wall horizontals */}
      {[[0,175,100,175],[0,262,150,262],[0,306,175,306],[0,328,187,328],
        [0,525,100,525],[0,437,150,437],[0,393,175,393],[0,371,187,371]].map(([x1,y1,x2,y2],i)=>(
        <Line key={`lw${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0b1020" strokeWidth="0.5" opacity="0.8"/>
      ))}
      {/* Right wall horizontals */}
      {[[400,175,300,175],[400,262,250,262],[400,306,225,306],[400,328,213,328],
        [400,525,300,525],[400,437,250,437],[400,393,225,393],[400,371,213,371]].map(([x1,y1,x2,y2],i)=>(
        <Line key={`rw${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0b1020" strokeWidth="0.5" opacity="0.8"/>
      ))}
      {/* Vanishing point glow rings */}
      <Circle cx="200" cy="350" r="40" fill="#0f1f35" opacity="0.5"/>
      <Circle cx="200" cy="350" r="20" fill="#1a3050" opacity="0.4"/>
      <Circle cx="200" cy="350" r="8"  fill="#3a6090" opacity="0.3"/>
      <Circle cx="200" cy="350" r="3"  fill="#6090c0" opacity="0.25"/>
    </Svg>
  );
}

/** Angular #midLayerSvg — viewBox="0 0 400 700" */
function MidLayerSvg({ width, height }) {
  return (
    <Svg
      width={width} height={height}
      viewBox="0 0 400 700"
      preserveAspectRatio="xMidYMid slice"
    >
      <Rect x="100" y="175" width="200" height="350"
        fill="none" stroke="#1a2540" strokeWidth="0.8" opacity="0.5"/>
      <Rect x="150" y="262" width="100" height="175"
        fill="none" stroke="#1a2840" strokeWidth="0.5" opacity="0.35"/>
      {/* Corner marks */}
      {[
        [100,175,110,175],[100,175,100,185],
        [300,175,290,175],[300,175,300,185],
        [100,525,110,525],[100,525,100,515],
        [300,525,290,525],[300,525,300,515],
      ].map(([x1,y1,x2,y2],i)=>(
        <Line key={`cm${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="#2a3a50" strokeWidth="1" opacity="0.5"/>
      ))}
    </Svg>
  );
}

/** Full VR depth background — renders corridor + mid layer */
function CorridorBg({ width, height }) {
  return (
    <View style={[StyleSheet.absoluteFillObject, { width, height, overflow:'hidden' }]}
      pointerEvents="none">
      {/* scene-bg: z=1, blur(5px) approximated — just draw at full opacity */}
      <View style={StyleSheet.absoluteFillObject}>
        <CorridorSvg width={width} height={height} />
      </View>
      {/* scene-mid: z=2, blur(2px) approximated — draw at low opacity */}
      <View style={[StyleSheet.absoluteFillObject, { opacity: 0.6 }]}>
        <MidLayerSvg width={width} height={height} />
      </View>
    </View>
  );
}

export default memo(CorridorBg);