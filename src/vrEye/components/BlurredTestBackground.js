// components/BlurredTestBackground.js
import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import CorridorBg from './tests/CorridorBg';

function Layer({ children, style }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, style]}>
      {children}
    </View>
  );
}

function BlurredTestBackground({
  panelWidth,
  panelHeight,
  parallax,
  showMid = true,
}) {
  const bgX = parallax?.bg?.x ?? 0;
  const bgY = parallax?.bg?.y ?? 0;
  const midX = parallax?.mid?.x ?? 0;
  const midY = parallax?.mid?.y ?? 0;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        { width: panelWidth, height: panelHeight },
      ]}
    >
      <Layer
        style={{
          transform: [
            { translateX: bgX * 0.35 },
            { translateY: bgY * 0.35 },
            { scale: 1.06 },
          ],
          opacity: 0.22,
        }}
      >
        <CorridorBg width="100%" height="100%" />
      </Layer>

      <Layer
        style={{
          transform: [
            { translateX: bgX * 0.18 },
            { translateY: bgY * 0.18 },
            { scale: 1.03 },
          ],
          opacity: 0.35,
        }}
      >
        <CorridorBg width="100%" height="100%" />
      </Layer>

      <Layer
        style={{
          transform: [
            { translateX: bgX * 0.08 },
            { translateY: bgY * 0.08 },
          ],
          opacity: 0.78,
        }}
      >
        <CorridorBg width="100%" height="100%" />
      </Layer>

      {showMid ? (
        <Layer
          style={{
            transform: [
              { translateX: midX * 0.12 },
              { translateY: midY * 0.12 },
              { scale: 1.01 },
            ],
            opacity: 0.18,
          }}
        >
          <CorridorBg width="100%" height="100%" />
        </Layer>
      ) : null}

      <View style={styles.darkWash} />
      <View style={styles.focusGlow} />
      <View style={styles.vignette} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  darkWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  focusGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 220,
    height: 220,
    marginLeft: -110,
    marginTop: -110,
    borderRadius: 999,
    backgroundColor: 'rgba(120,140,255,0.05)',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 54,
    borderColor: 'rgba(0,0,0,0.54)',
  },
});

export default memo(BlurredTestBackground);