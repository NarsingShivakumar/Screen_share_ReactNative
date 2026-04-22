/**
 * IshiharaTest.js  v5.0
 *
 * ── Source of truth: patient.component.html ───────────────────────────────────
 *
 *   <svg viewBox="0 0 200 200" class="ishihara-svg">
 *     <defs>
 *       <clipPath id="clip-L">
 *         <circle cx="100" cy="100" r="93" />
 *       </clipPath>
 *     </defs>
 *     <circle cx="100" cy="100" r="94" fill="#f8f5f0" />   ← cream background
 *     <g clip-path="url(#clip-L)">
 *       <circle *ngFor="let dot of currentPlateDots"
 *         [cx]="dot.cx" [cy]="dot.cy" [r]="dot.r" [fill]="dot.fill" />
 *     </g>
 *     <circle cx="100" cy="100" r="93" fill="none" stroke="#ccc" stroke-width="0.5" />
 *   </svg>
 *
 *   .ishihara-wrapper:
 *     width: min(92%, 92vh * 0.48); max-width: 340px
 *
 *   .ishihara-svg:
 *     width: 100%; height: auto
 *     filter: drop-shadow(0 4px 24px rgba(0,0,0,.45))
 *
 *   .plate-badge:
 *     font-size: 9px; color: rgba(200,200,200,.55)
 *     "Plate {plateNum}/{totalPlates}"
 *
 *   Phase hint: "What number do you see?"
 *
 * ── Key difference from previous version ─────────────────────────────────────
 *   Background is #f8f5f0 (cream/warm white), NOT dark.
 *   Dots are rendered on this cream background — correct clinical Ishihara.
 *   No dark VR background inside the plate circle.
 *
 * ── VR 3D effects ─────────────────────────────────────────────────────────────
 *   Barrel vignette, drop-shadow matching Angular filter, chromatic ring.
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Circle, Defs, ClipPath } from 'react-native-svg';

// ── Barrel vignette ───────────────────────────────────────────────────────────
function BarrelVignette({ panelWidth, panelHeight }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.vignette, { width: panelWidth, height: panelHeight }]}
    />
  );
}

// ── Ishihara plate SVG — exact match to Angular template ─────────────────────
function IshiharaPlate({ dots, size, plateNum, totalPlates }) {
  if (!dots || dots.length === 0) {
    return (
      <View style={[styles.emptyPlate, { width: size, height: size, borderRadius: size / 2 }]} />
    );
  }

  return (
    <View style={[
      styles.plateShadow,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        // filter: drop-shadow(0 4px 24px rgba(0,0,0,.45)) → RN equivalent:
        shadowRadius: 12,
        elevation: Platform.OS === 'android' ? 12 : 0,
      },
    ]}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        style={{ borderRadius: size / 2 }}
      >
        <Defs>
          {/* Matches: <clipPath id="clip-L"><circle cx="100" cy="100" r="93" /></clipPath> */}
          <ClipPath id="plateClip">
            <Circle cx="100" cy="100" r="93" />
          </ClipPath>
        </Defs>

        {/* Matches: <circle cx="100" cy="100" r="94" fill="#f8f5f0" /> */}
        <Circle cx="100" cy="100" r="94" fill="#f8f5f0" />

        {/*
          Dots clipped inside r=93.
          CRITICAL: No opacity/filter/colorFilter on dots — invalidates test.
          Matches: <g clip-path="url(#clip-L)"><circle ... /></g>
        */}
        {dots.map((dot, i) => (
          <Circle
            key={`${i}-${dot.cx.toFixed(1)}-${dot.cy.toFixed(1)}`}
            cx={dot.cx}
            cy={dot.cy}
            r={dot.r}
            fill={dot.fill}
            clipPath="url(#plateClip)"
          />
        ))}

        {/* Matches: <circle r="93" fill="none" stroke="#ccc" stroke-width="0.5" /> */}
        <Circle
          cx="100" cy="100" r="93"
          fill="none"
          stroke="#cccccc"
          strokeWidth="0.5"
        />
      </Svg>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function IshiharaTest({ dots, plateIndex, totalPlates, panelWidth, panelHeight, parallax }) {
  const PW = panelWidth ?? 400;
  const PH = panelHeight ?? 300;

  // .ishihara-wrapper: width: min(92%, 92vh*0.48); max-width: 340px
  const plateSize = Math.min(
    Math.round(PW * 0.92),
    Math.round(PH * 0.92 * 0.48),
    340,
  );

  const plateNum = (plateIndex ?? 0) + 1;

  return (
    <View style={[styles.panel, { width: PW, height: PH }]}>

      <BarrelVignette panelWidth={PW} panelHeight={PH} />

      <View style={[styles.wrapper, { width: plateSize }]}>

        {/* .plate-badge — "Plate N/12" */}
        <Text style={styles.plateBadge}>
          Plate {plateNum}/{totalPlates ?? 12}
        </Text>

        <IshiharaPlate
          dots={dots}
          size={plateSize}
          plateNum={plateNum}
          totalPlates={totalPlates}
        />

      </View>

      {/* .phase-hint.ar-hint — "What number do you see?" */}
      <Text style={styles.hint}>What number do you see?</Text>

    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },

  vignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'transparent',
    borderWidth: 54,
    borderColor: 'rgba(0,0,0,0.66)',
    borderRadius: 999,
    zIndex: 20,
    pointerEvents: 'none',
  },

  // .ishihara-wrapper
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // .plate-badge
  plateBadge: {
    position: 'absolute',
    top: -18,
    left: 2,
    fontSize: 9,                          // Angular: font-size: 9px
    fontFamily: 'Helvetica Neue',
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(200,200,200,0.55)',   // Angular: color: rgba(200,200,200,.55)
    zIndex: 14,
  },

  // Shadow wrap for the plate
  plateShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,                       // Angular: drop-shadow(0 4px 24px rgba(0,0,0,.45))
    shadowRadius: 12,
    zIndex: 10,
  },

  emptyPlate: {
    backgroundColor: '#f8f5f0',
  },

  // .phase-hint.ar-hint
  hint: {
    marginTop: 10,                         // Angular: margin-top: 10px
    fontSize: 11,                         // Angular: font-size: 11px
    color: '#dddddd',                  // Angular: color: #ddd
    backgroundColor: 'rgba(0,0,0,0.55)',       // Angular: background: rgba(0,0,0,.55)
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
    zIndex: 5,
  },
});

export default memo(IshiharaTest);