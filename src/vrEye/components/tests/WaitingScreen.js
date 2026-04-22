/**
 * WaitingScreen.js  v5.0
 *
 * ── Exact port of Angular #eyePair template (phase=waiting) + .scss ───────────
 *
 * STRUCTURE (from HTML):
 *   .scene-layer.scene-bg  → corridorSvg (blur 5px)
 *   .scene-layer.scene-fg  → .instruction-content
 *     .logo-ring             — spinning indigo ring
 *     .inst-text             — instruction text
 *     .inst-sub              — "Patient: [name]" (conditional)
 *
 * .instruction-content:
 *   flex-direction:column; align-items:center; gap:16px
 *   padding:30px; text-align:center; z-index:3
 *
 * .logo-ring:
 *   width:48px; height:48px; border-radius:50%
 *   border: 3px solid #5b5bd6
 *   animation: spin 3s linear infinite
 *
 * .inst-text:
 *   color:#fff; font-size:14px; line-height:1.6; max-width:180px
 *   text-shadow: 0 1px 6px rgba(0,0,0,.9)
 *
 * .inst-sub:
 *   color:#aaa; font-size:12px
 *   text-shadow: 0 1px 4px rgba(0,0,0,.8)
 */

import React, { memo, useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import CorridorBg from './CorridorBg';

function WaitingScreen({ message, patientName }) {
  //   // Angular .logo-ring: animation spin 3s linear infinite
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
    ).start();
  }, []);
  const rotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={w.content}>
      {/* .logo-ring: width:48px height:48px border-radius:50% border:3px solid #5b5bd6 */}
      <Animated.View style={[w.logoRing, { transform: [{ rotate }] }]} />
      {/* .inst-text: color:#fff font-size:14px line-height:1.6 max-width:180px */}
      <Text style={w.instText}>{message}</Text>
      {patientName ? (
        /* .inst-sub: color:#aaa font-size:12px */
        <Text style={w.instSub}>Patient: {patientName}</Text>
      ) : null}
    </View>
  );
}

const w = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: 16,             // Angular: gap: 16px
    paddingHorizontal: 30,      // Angular: padding: 30px
    paddingVertical: 30,
  },
  // .logo-ring: width:48px height:48px border-radius:50% border:3px solid #5b5bd6
  logoRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#5b5bd6',
  },
  // .inst-text: color:#fff font-size:14px line-height:1.6 max-width:180px
  instText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 22,             // 14 × 1.6
    maxWidth: 180,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  // .inst-sub: color:#aaa font-size:12px
  instSub: {
    color: '#aaaaaa',
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

export default memo(WaitingScreen);