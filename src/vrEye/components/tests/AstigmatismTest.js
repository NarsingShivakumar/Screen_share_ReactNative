/**
 * AstigmatismTest.js  v5.0
 *
 * ── Source of truth: patient.component.html ───────────────────────────────────
 *
 *   <svg viewBox="0 0 100 100" class="clock-svg">
 *     <circle cx="50" cy="50" r="45" fill="none" stroke="#555" stroke-width="0.5" />
 *     <line *ngFor="let a of clockAngles"
 *       [x1]="lineCoords(a).x1" [y1]="lineCoords(a).y1"
 *       [x2]="lineCoords(a).x2" [y2]="lineCoords(a).y2"
 *       stroke="white" stroke-width="2.5" stroke-linecap="round" />
 *     <circle cx="50" cy="50" r="3" fill="#888" />
 *   </svg>
 *
 *   clockAngles = [0, 30, 60, 90, 120, 150]
 *
 *   lineCoords(angleDeg):
 *     rad = angleDeg * π / 180
 *     x1 = 50 + 42*cos(rad)   y1 = 50 + 42*sin(rad)
 *     x2 = 50 - 42*cos(rad)   y2 = 50 - 42*sin(rad)
 *
 *   .clock-svg: width: 160px; height: 160px
 *
 *   .ar-clock-disc:
 *     background: rgba(10,10,10,.88)
 *     box-shadow: 0 0 0 2px rgba(80,80,80,.4), 0 8px 32px rgba(0,0,0,.5)
 *     border-radius: 50%
 *     padding: 10%
 *
 *   Hint: "Which lines look darkest?"
 *
 * ── Key geometry (from lineCoords) ────────────────────────────────────────────
 *   Centre: (50, 50)
 *   Line half-radius: 42 units
 *   Outer circle: r=45, stroke=#555, no fill
 *   Lines: stroke=white, strokeWidth=2.5, strokeLinecap=round
 *   Centre dot: r=3, fill=#888
 *   6 meridians: 0°, 30°, 60°, 90°, 120°, 150°
 *
 * ── VR 3D effects (React Native only) ─────────────────────────────────────────
 *   Barrel vignette, disc elevation shadow.
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

// Exact from patient.component.ts
const CLOCK_ANGLES = [0, 30, 60, 90, 120, 150];

// Exact from patient.component.ts — lineCoords(angleDeg)
function lineCoords(angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x1: 50 + 42 * Math.cos(rad),
    y1: 50 + 42 * Math.sin(rad),
    x2: 50 - 42 * Math.cos(rad),
    y2: 50 - 42 * Math.sin(rad),
  };
}

// Compute label position just outside the line endpoint (r=48, slightly beyond r=42 line tips)
function labelCoords(angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const r = 48; // just outside the line tip (42) and inside the circle border (45 + padding)
  return {
    // positive end
    x1: 50 + r * Math.cos(rad),
    y1: 50 + r * Math.sin(rad),
    // negative end (opposite side)
    x2: 50 - r * Math.cos(rad),
    y2: 50 - r * Math.sin(rad),
  };
}
function BarrelVignette({ panelWidth, panelHeight }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.vignette, { width: panelWidth, height: panelHeight }]}
    />
  );
}

// ── Clock dial — exact match to Angular SVG ───────────────────────────────────
function ClockDial({ svgSize }) {
  return (
    /*
      .ar-clock-disc:
        background: rgba(10,10,10,.88)
        box-shadow: 0 0 0 2px rgba(80,80,80,.4), 0 8px 32px rgba(0,0,0,.5)
        border-radius: 50%
        padding: 10%
    */
    <View style={[
      styles.clockDisc,
      {
        width: svgSize + Math.round(svgSize * 0.2),
        height: svgSize + Math.round(svgSize * 0.2),
        borderRadius: (svgSize + Math.round(svgSize * 0.2)) / 2,
        elevation: Platform.OS === 'android' ? 14 : 0,
      },
    ]}>
      {/*
        <svg viewBox="0 0 100 100" width="160" height="160">
          Exact match — viewBox 0 0 100 100, width/height = 160px (Angular .clock-svg)
      */}
      <Svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 100 100"
      >
        {/* <circle cx="50" cy="50" r="45" fill="none" stroke="#555" stroke-width="0.5" /> */}
        <Circle
          cx="50" cy="50" r="45"
          fill="none"
          stroke="#555555"
          strokeWidth="0.5"
        />

        {/* 6 meridian lines — exact geometry from lineCoords() */}
        {CLOCK_ANGLES.map(deg => {
          const { x1, y1, x2, y2 } = lineCoords(deg);
          return (
            <Line
              key={`line-${deg}`}
              x1={x1} y1={y1}
              x2={x2} y2={y2}
              stroke="white"          // Angular: stroke="white"
              strokeWidth="2.5"       // Angular: stroke-width="2.5"
              strokeLinecap="round"   // Angular: stroke-linecap="round"
            />
          );
        })}

        {/* Degree labels at both ends of each meridian line */}
        {CLOCK_ANGLES.map(deg => {
          const { x1, y1, x2, y2 } = labelCoords(deg);
          return (
            <React.Fragment key={`label-${deg}`}>
              {/* Positive end label */}
              <SvgText
                x={x1}
                y={y1}
                fill="white"
                fontSize="5"
                fontWeight="400"
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {`${deg}°`}
              </SvgText>
              {/* Opposite end label — same angle, other side */}
              <SvgText
                x={x2}
                y={y2}
                fill="white"
                fontSize="5"
                fontWeight="400"
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {`${deg}°`}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* <circle cx="50" cy="50" r="3" fill="#888" /> */}
        <Circle cx="50" cy="50" r="3" fill="#888888" />
      </Svg>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function AstigmatismTest({ panelWidth, panelHeight, parallax }) {
  const PW = panelWidth ?? 400;
  const PH = panelHeight ?? 300;

  // Angular: .clock-svg { width: 160px; height: 160px }
  // Scale proportionally for the panel — keep 160px as reference, scale if smaller
  const svgSize = Math.min(160, Math.round(Math.min(PW, PH) * 0.52));

  return (
    <View style={[styles.panel, { width: PW, height: PH }]}>

      <BarrelVignette panelWidth={PW} panelHeight={PH} />

      <ClockDial svgSize={svgSize} />

      {/* .phase-hint.ar-hint — "Which lines look darkest?" */}
      <Text style={styles.hint}>Which lines look darkest?</Text>

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

  // .ar-clock-disc
  clockDisc: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,10,0.88)',    // Angular: rgba(10,10,10,.88)
    borderWidth: 2,
    borderColor: 'rgba(80,80,80,0.4)',     // Angular: 0 0 0 2px rgba(80,80,80,.4)
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 }, // Angular: 0 8px 32px rgba(0,0,0,.5)
    shadowOpacity: 0.5,
    shadowRadius: 16,
    zIndex: 10,
  },

  // .phase-hint.ar-hint
  hint: {
    marginTop: 10,
    fontSize: 11,
    color: '#dddddd',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
    zIndex: 5,
  },
});

export default memo(AstigmatismTest);