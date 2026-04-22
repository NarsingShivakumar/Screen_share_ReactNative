/**
 * OptotypeTest.js  v7.0
 *
 * ── Source of truth: patient.component.ts + calibration.service.ts ────────────
 *
 *  CRITICAL CHANGE from v6:
 *    OLD (wrong):  fontSize = sizePx from socket  (hardcoded table, ignores device PPI)
 *    NEW (correct): fontSize = calibrationService.calibratedFontSizePx(sizeLevel, screenW, screenH)
 *
 *  Angular getFontSize() getter:
 *    get calibratedFontSizePx(): number {
 *      const raw    = this.calib.levelToPixels(this.optotype.sizeLevel ?? 0);
 *      const discPx = Math.min(window.innerHeight * 0.80, window.innerWidth * 0.45);
 *      const maxPx  = discPx * 0.90;
 *      return Math.min(raw, maxPx);
 *    }
 *
 *  .ar-optotype-disc (Angular SCSS, updated rule):
 *    width:  min(80dvh, 45dvw)   per eye panel  → Math.min(screenH*0.80, panelW*0.90)
 *    height: same
 *    border-radius: 50%
 *    overflow: hidden            ← E is clipped at disc boundary
 *    padding: 0                  ← NOT 18%; disc is tight around the E
 *    box-shadow: 0 0 0 2px rgba(180,180,180,.35), 0 0 60px rgba(0,0,0,.5)
 *    background: transparent     ← in Angular's updated .ar-optotype-disc rule
 *
 *  .tumbling-e (Angular SCSS — exact):
 *    font-family: 'Courier New', Courier, monospace
 *    font-weight: 900
 *    color: #fff                 ← white (VR dark background)
 *    line-height: 1
 *    will-change: font-size, transform, opacity
 *
 *  Zoom animation (Angular keyframes):
 *    zoom-in  → enterBig:   scale 0.5→1, opacity 0→1  (spring 0.34,1.56,0.64,1)
 *    zoom-out → enterSmall: scale 1.6→1, opacity 0→1  (ease  0.22,1,0.36,1)
 *    Duration: 400ms
 *
 *  Near vision font sizes — exact from Angular getNearFontSize():
 *    [39, 29, 23, 16, 13, 8]  px, index 0..5
 *    font-family: 'Courier New', monospace; font-weight: 900
 *    color: #111; letter-spacing: 0.08em
 *
 *  NEAR_LINES — exact from patient.component.ts:
 *    { label: 'N24', text: 'E' }
 *    { label: 'N18', text: 'F  P' }
 *    { label: 'N14', text: 'T  O  Z' }
 *    { label: 'N10', text: 'L  P  E  D' }
 *    { label: 'N8',  text: 'P  E  C  F  D' }
 *    { label: 'N5',  text: 'H  N  O  R  C  V' }
 */

import React, { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import calibrationService from '../../services/calibrationService';
import BlurredTestBackground from '../BlurredTestBackground';

// ── Near vision — exact from patient.component.ts ────────────────────────────
export const NEAR_LINES = [
  { label: 'N24', text: 'E' },
  { label: 'N18', text: 'F  P' },
  { label: 'N14', text: 'T  O  Z' },
  { label: 'N10', text: 'L  P  E  D' },
  { label: 'N8', text: 'P  E  C  F  D' },
  { label: 'N5', text: 'H  N  O  R  C  V' },
];

// Angular getNearFontSize() — exact array [39, 29, 23, 16, 13, 8]
const NEAR_FONT_SIZES = [39, 29, 23, 16, 13, 8];

// ─────────────────────────────────────────────────────────────────────────────
function OptotypeTest({ optotype, showLeft, showRight, phase, panelWidth, panelHeight, parallax }) {
  const screen = Dimensions.get('window');
  // In landscape VR: full screen width = both eye panels combined
  const screenW = Math.max(screen.width, screen.height);   // landscape width
  const screenH = Math.min(screen.width, screen.height);   // landscape height

  const scaleAnim = useRef(new Animated.Value(1)).current;
  // start hidden — no single-frame flash before the entrance animation fires
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const prevSizePx = useRef(48);
  const runningAnim = useRef(null);

  // ── Calibrated font size — Angular calibratedFontSizePx getter ────────────
  const fontSize = optotype
    ? calibrationService.calibratedFontSizePx(optotype.sizeLevel ?? 0, screenW, screenH)
    : 48;
  const rotation = optotype?.rotation ?? 0;
  const letter = optotype?.letter ?? 'E';


  // ── Disc size — Angular .ar-optotype-disc updated rule ────────────────────
  // Angular: width: min(80dvh, 45dvw)  per-panel
  // dvh in landscape ≈ screenH (portrait-mode short axis)
  // dvw in landscape ≈ panelWidth (one eye's share of full width)
  const discSize = Math.min(screenH * 0.80, (panelWidth ?? screenW / 2) * 0.90);

  // ── Zoom animation — Angular enterBig / enterSmall keyframes ──────────────
  useEffect(() => {
    if (runningAnim.current) {
      runningAnim.current.stop();
      runningAnim.current = null;
    }
    if (!optotype) {
      opacityAnim.setValue(0);
      return;
    }
    const newSizePx = calibrationService.calibratedFontSizePx(
      optotype.sizeLevel ?? 0, screenW, screenH,
    );
    const zoomIn = newSizePx > prevSizePx.current;
    prevSizePx.current = newSizePx;

    opacityAnim.setValue(0);
    scaleAnim.setValue(zoomIn ? 0.5 : 1.6);

    runningAnim.current = Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 180,
        friction: 9,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]);
    runningAnim.current.start(({ finished }) => {
      if (finished) runningAnim.current = null;
    });
  }, [!!optotype, optotype?.sizeLevel, optotype?.rotation ?? 0]);

  // ── Waiting state ──────────────────────────────────────────────────────────
  if (!optotype) {
    return (
      <View style={[styles.panel, { width: panelWidth, height: panelHeight }]}>
        <View style={styles.fixCrossWrap}>
          <View style={styles.fixH} />
          <View style={styles.fixV} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.panel, { width: panelWidth, height: panelHeight }]}>
      {/*
        .ar-optotype-disc (Angular updated rule):
          width: min(80dvh, 45dvw) — circular, overflow hidden
          background: transparent (updated rule overrides white)
          box-shadow: 0 0 0 2px rgba(180,180,180,.35), 0 0 60px rgba(0,0,0,.5)
          padding: 0 (updated)

        Note: The white circular background from the first rule
        (.ar-optotype-disc background: rgba(255,255,255,.96))
        is OVERRIDDEN by the later rule in Angular SCSS (background: transparent).
        In VR mode the background is black, so the E appears white on black.
      */}
      <View style={styles.backgroundLayer} pointerEvents="none">
        <BlurredTestBackground
          panelWidth={panelWidth}
          panelHeight={panelHeight}
          parallax={parallax}
        />
      </View>
      <View pointerEvents="none" style={styles.contentLayer}>
        {/*
          FIX: Split the animated wrapper from the clipping disc.
          Android computes the overflow:hidden clip mask for an Animated.View
          using a polygon approximation — with a large borderRadius this
          produces a visible octagon instead of a circle.
          Solution: the outer Animated.View owns ONLY opacity + scale (no
          overflow/borderRadius), and the inner plain View owns the circular
          clip. The native driver never sees a rounded-overflow view, so the
          clip is always a perfect circle.
        */}
        {/* <Animated.View
          style={[
            styles.foregroundCard,
            {
              width: discSize,
              height: discSize,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        > */}
        {/* Inner view owns overflow:hidden + borderRadius → always a clean circle */}
        <View
          style={[
            styles.disc,
            {
              width: discSize,
              height: discSize,
              borderRadius: discSize / 2,
            },
          ]}
        >
          <View style={styles.eWrap}>
            <Text
              style={[
                styles.tumblingE,
                {
                  fontSize: fontSize,
                  transform: [{ rotate: `${rotation}deg` }],
                },
              ]}
              allowFontScaling={false}
              numberOfLines={1}
            >
              {letter}
            </Text>
          </View>
        </View>
        {/* </Animated.View> */}

        {/* Angular .ar-hint equivalent */}
        {/* <Text style={styles.hint}>Tell the assistant the direction</Text> */}
      </View>
    </View>

  );
}

// ── Near Vision Sub-component ─────────────────────────────────────────────────
export function NearVisionLines({ panelWidth, panelHeight, showLeft, showRight, parallax }) {
  /**
      * Angular .near-card styles (from SCSS):
      *   background: #fff
      *   border-radius: 8px
      *   padding: 16px 24px
      *   box-shadow: 0 4px 20px rgba(0,0,0,.4)
      *   max-width: 340px
      *   user-select: none
      *
      * Angular getNearFontSize():
      *   return ([39, 29, 23, 16, 13, 8])[lineIndex] ?? 8
      *
      * Angular .near-text:
      *   color: #111
      *   font-family: 'Courier New', monospace
      *   font-weight: 900
      *   line-height: 1
      *   letter-spacing: .08em
      *   text-transform: uppercase
      */
  return (
    <View style={[styles.nearPanel, { width: panelWidth, height: panelHeight }]}>
      <View style={styles.nearCard}>
        {NEAR_LINES.map((line, i) => (
          <Text
            key={line.label}
            style={[
              styles.nearText,
              {
                fontSize: NEAR_FONT_SIZES[i] ?? 8,   // Angular getNearFontSize()
                lineHeight: NEAR_FONT_SIZES[i] ?? 8,   // line-height: 1
                letterSpacing: (NEAR_FONT_SIZES[i] ?? 8) * 0.08, // letter-spacing: .08em
              },
            ]}
            allowFontScaling={false}
          >
            {line.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Optotype panel (.split-eye) ────────────────────────────────────────────
  panel: {
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  contentLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    elevation: 1,
  },
  // .ar-optotype-disc (updated Angular rule — background: transparent)
  // overflow + borderRadius are set INLINE on this view, not here, so the
  // Animated.View parent never has a rounded overflow — that was the octagon cause.
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',          // Angular: overflow: hidden; E clipped at disc boundary
    backgroundColor: 'transparent',   // Angular updated rule
    // Angular box-shadow second layer: 0 0 60px rgba(0,0,0,.5)
    // First layer (0 0 0 2px spread) omitted — borderWidth on a circle = octagon on Android
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 16,
  },
  foregroundCard: {
    zIndex: 999999990,
    elevation: 60,
  },
  eWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // .tumbling-e
  tumblingE: {
    color: '#ffffff',          // Angular: color: #fff (VR dark mode)
    // fontFamily: 'CourierPrime-Regular',     // Angular: 'Courier New', 'Courier', 'monospace',
    fontFamily: 'CourierPrime-Regular',
    // fontWeight: '900',             // Angular: font-weight: 900
    lineHeight: undefined,         // Angular: line-height: 1 (set per fontSize below)
    includeFontPadding: false,
    textAlignVertical: 'center',
    textAlign: 'center',
  },

  // Waiting fixation cross
  fixCrossWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  fixH: { position: 'absolute', width: 24, height: 1, backgroundColor: '#1a1a1a' },
  fixV: { position: 'absolute', width: 1, height: 24, backgroundColor: '#1a1a1a' },

  // .ar-hint
  hint: {
    color: '#555555',   // Angular .phase-hint: color: #555
    fontSize: 11,
    marginTop: 12,          // Angular: margin-top: 12px
    textAlign: 'center',
    letterSpacing: 0.3,
    zIndex: 5,
  },

  // ── Near vision (.near-card) ───────────────────────────────────────────────
  nearPanel: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  nearContentLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  nearCard: {
    backgroundColor: '#ffffff',             // Angular: background: #fff
    borderRadius: 8,                     // Angular: border-radius: 8px
    paddingVertical: 16,                    // Angular: padding: 16px 24px
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 4,                     // Angular: gap between lines
    maxWidth: 340,                   // Angular: max-width: 340px
    // box-shadow: 0 4px 20px rgba(0,0,0,.4)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
  },
  // .near-text
  nearText: {
    color: '#111111',         // Angular: color: #111
    fontFamily: 'Courier New',    // Angular: 'Courier New', Courier, monospace
    fontWeight: '900',            // Angular: font-weight: 900
    // fontSize / lineHeight / letterSpacing set inline from NEAR_FONT_SIZES
    textAlign: 'center',
    // Angular: text-transform: uppercase — text is already uppercase in NEAR_LINES
  },
});

export default memo(OptotypeTest);