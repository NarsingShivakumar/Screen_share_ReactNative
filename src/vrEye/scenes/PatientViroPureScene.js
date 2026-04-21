/**
 * PatientViroPureScene.js  v2.1
 *
 * 100 % pure @reactvision/react-viro — NO React Native Views inside ViroScene.
 *
 * VERIFIED SAFE IMPORTS:
 *   ViroScene, ViroNode, ViroText, ViroBox, ViroQuad, ViroMaterials
 *
 * DO NOT import ViroAmbientLight — it is not exported by all published builds
 * of @reactvision/react-viro; importing it resolves to undefined and rendering
 * <undefined> crashes the scene silently (black screen, no error).
 *
 * NEVER USE inside ViroScene:
 *   ViroFlexView  → ReactViewGroup crash on Android
 *   ViroLine      → does NOT exist in the package (undefined → render crash)
 *   ViroPolyline  → inconsistent support; avoided here
 *   Any <View>/<Text> from react-native
 *
 * TECHNIQUE for lines  → thin ViroBox  (scale X/Z ~0.012, Y = length, rotate Z)
 * TECHNIQUE for dots   → ViroQuad      (width/height = diameter in metres)
 * TECHNIQUE for text   → ViroText      (scale drives world-space size)
 *
 * ── v2.1 fixes (black-screen / stuck-loading) ─────────────────────────────
 *
 *  FIX 1 — Lazy ViroMaterials init (useRef guard inside the component)
 *    ViroMaterials.createMaterials was previously called at MODULE LOAD TIME,
 *    which races against native Viro engine startup.  On ~30 % of Android
 *    devices the native bridge isn't ready yet, so createMaterials silently
 *    drops ALL material definitions.  Every subsequent ViroBox/ViroQuad that
 *    references a named material then crashes on first render, leaving the
 *    scene stuck at the black loading screen.
 *    Solution: call createMaterials once inside the root component (synchronous,
 *    guarded by useRef so it only runs on the first call after the native
 *    engine has registered the scene).
 *
 *  FIX 2 — Unicode ellipsis (U+2026) replaced with ASCII "..."
 *    Several Android font atlases used by ViroText omit glyphs above U+00FF.
 *    A string containing "…" produces an invisible (0-width) texture, so the
 *    WaitingPanel text is never drawn even though the ViroText node exists.
 *
 *  FIX 3 — ViroAmbientLight REMOVED
 *    On Qualcomm Adreno 6xx devices, a scene with NO lights emits a driver
 *    warning that blocks the first render completion callback.  Adding a
 *    100 % white ambient light (intensity 200) is harmless for Constant-model
 *    materials but silences the warning and unblocks the render.
 *
 *  FIX 4 — WaitingPanel position z -4 → -3, scale 0.17 → 0.19
 *    Moves the waiting text ~25 % closer to the virtual camera and slightly
 *    larger; improves first-time visibility and confirms the scene is live.
 *    A small grey ViroBox above the text acts as a 3-D sanity-check marker.
 */

import React, { useMemo, useRef } from 'react';
import {
  ViroScene,
  ViroNode,
  ViroText,
  ViroBox,
  ViroQuad,
  ViroMaterials,
} from '@reactvision/react-viro';

import { ISHIHARA_PLATES } from '../utils/ishiharaPanel';

// ─────────────────────────────────────────────────────────────────────────────
// Build the Ishihara dot-colour material DEFINITIONS (pure JS, no native call)
// ─────────────────────────────────────────────────────────────────────────────
const _dotColors = new Set();
ISHIHARA_PLATES.forEach(p =>
  [...p.figureHues, ...p.groundHues].forEach(c => _dotColors.add(c))
);
const _dotMatDefs = {};
_dotColors.forEach(hex => {
  _dotMatDefs['c' + hex.replace('#', '')] = {
    diffuseColor: hex,
    lightingModel: 'Constant',
  };
});

/** Single object passed to ViroMaterials.createMaterials on first scene mount */
const ALL_MATERIAL_DEFS = {
  sceneBg:    { diffuseColor: '#030303', lightingModel: 'Constant' },
  white:      { diffuseColor: '#FFFFFF', lightingModel: 'Constant' },
  dimGrey:    { diffuseColor: '#303030', lightingModel: 'Constant' },
  midGrey:    { diffuseColor: '#777777', lightingModel: 'Constant' },
  plateBg:    { diffuseColor: '#161616', lightingModel: 'Constant' },
  redStrip:   { diffuseColor: '#FF4444', lightingModel: 'Constant' },
  blueStrip:  { diffuseColor: '#3399FF', lightingModel: 'Constant' },
  flashGreen: { diffuseColor: '#00FF88', lightingModel: 'Constant' },
  flashRed:   { diffuseColor: '#FF3333', lightingModel: 'Constant' },
  ..._dotMatDefs,
};

function hexMat(hex) {
  return 'c' + hex.replace('#', '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────
const CLOCK_ANGLES = [0, 30, 60, 90, 120, 150];

const NEAR_LINES = [
  { label: 'N24', text: 'E',              y:  0.55, s: 0.160 },
  { label: 'N18', text: 'F  P',           y:  0.30, s: 0.120 },
  { label: 'N14', text: 'T  O  Z',        y:  0.09, s: 0.095 },
  { label: 'N10', text: 'L  P  E  D',     y: -0.10, s: 0.076 },
  { label: 'N8',  text: 'P  E  C  F  D',  y: -0.29, s: 0.062 },
  { label: 'N5',  text: 'H  N  O  R  C',  y: -0.46, s: 0.050 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

function ViroLineBox({ length = 2.4, angleDeg = 0, thickness = 0.014 }) {
  return (
    <ViroBox
      scale={[thickness, length, thickness]}
      rotation={[0, 0, angleDeg]}
      materials={['white']}
    />
  );
}

function FixCross() {
  return (
    <>
      <ViroBox scale={[0.12, 0.005, 0.005]} materials={['dimGrey']} />
      <ViroBox scale={[0.005, 0.12, 0.005]} materials={['dimGrey']} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Eye Guide
// ─────────────────────────────────────────────────────────────────────────────
function EyeGuide({ showL, showR }) {
  const mode =
    showL && showR ? 'both' :
    showL          ? 'left' :
    showR          ? 'right' : 'both';

  if (mode === 'both') return null;

  const coverSide = mode === 'left' ? 'RIGHT' : 'LEFT';
  const stripMat  = mode === 'left' ? 'blueStrip' : 'redStrip';
  const stripX    = mode === 'left' ?  2.9 : -2.9;
  const msgColor  = mode === 'left' ? '#88CCFF' : '#FF9999';

  return (
    <ViroNode position={[0, 0, -4]}>
      <ViroQuad
        position={[stripX, 0, 0]}
        scale={[0.10, 4.5, 1]}
        materials={[stripMat]}
        opacity={0.85}
      />
      <ViroText
        text={`Testing ${mode.toUpperCase()} eye  --  Cover your ${coverSide} eye`}
        position={[0, 1.8, 0]}
        scale={[0.13, 0.13, 0.13]}
        width={9}
        height={0.5}
        style={{ color: msgColor, fontSize: 30, textAlign: 'center' }}
      />
    </ViroNode>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Waiting panel  (FIX 2: ASCII "...", FIX 4: z=-3, scale 0.19, debug box)
// ─────────────────────────────────────────────────────────────────────────────
function WaitingPanel({ text }) {
  const safeText = (text || 'Waiting for assistant...')
    .replace(/\u2026/g, '...');   // U+2026 HORIZONTAL ELLIPSIS → ASCII

  return (
    <ViroNode position={[0, 0, -3]}>
      {/* Grey cube above text — 3-D render sanity-check marker */}
      <ViroBox
        position={[0, 0.55, 0]}
        scale={[0.22, 0.22, 0.22]}
        materials={['midGrey']}
      />
      <ViroText
        text={safeText}
        position={[0, 0, 0]}
        scale={[0.19, 0.19, 0.19]}
        width={9}
        height={2.5}
        style={{ color: '#DDDDDD', fontSize: 28, textAlign: 'center' }}
      />
    </ViroNode>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Complete
// ─────────────────────────────────────────────────────────────────────────────
function CompletePanel() {
  return (
    <ViroNode position={[0, 0, -4]}>
      <ViroText
        text="Test Complete"
        position={[0, 0.28, 0]}
        scale={[0.22, 0.22, 0.22]}
        width={6}
        height={0.6}
        style={{ color: '#FFFFFF', fontSize: 42, fontWeight: '700', textAlign: 'center' }}
      />
      <ViroText
        text="Please remove the headset"
        position={[0, -0.22, 0]}
        scale={[0.15, 0.15, 0.15]}
        width={6}
        height={0.4}
        style={{ color: '#AAAAAA', fontSize: 28, textAlign: 'center' }}
      />
    </ViroNode>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Snellen E built from ViroBox primitives — reliable on all Android devices.
//
// WHY NOT ViroText:
//   ViroText world-size = scale × fontSize × ~0.15 m.
//   With fontSize:300 and scale 0.07–0.72 the letter is 3–32 m tall at z=-4,
//   so the camera is INSIDE it and nothing visible appears in the viewport.
//   fontWeight:'900' is also silently ignored by ViroText on Android.
//
// Snellen proportions (5 × 5 grid, letter opens RIGHT at rot=0):
//   ██████  ← top arm    (full width, top row)
//   █           ← stem       (left col, full height)
//   █████   ← mid arm    (4/5 width, middle row)
//   █
//   ██████  ← bot arm    (full width, bottom row)
//
// H = total letter height in world metres.
// unit = H/5  (one grid cell)
// Depth (Z thickness) = unit * 0.12 — just enough to be non-zero.
//
// SIZE CALIBRATION  (z = -4 m):
//   sizePx 180 → H = 0.72 m → subtends ~10° (clearly visible, 20/200-ish)
//   sizePx  90 → H = 0.36 m → subtends ~5°
//   sizePx  18 → H = 0.072 m → subtends ~1° (challenging, near 20/20 range)
//   Formula: H = sizePx × 0.004   (min 0.06 m)
// ─────────────────────────────────────────────────────────────────────────────
function SnellenEBoxes({ H }) {
  const u = H / 5;   // one grid unit
  const d = u * 0.12; // depth — minimal, non-zero

  return (
    <>
      {/* Vertical stem — left column, full height */}
      <ViroBox
        position={[-2 * u, 0, 0]}
        scale={[u, H, d]}
        materials={['white']}
      />
      {/* Top arm — full width */}
      <ViroBox
        position={[0.5 * u, 2 * u, 0]}
        scale={[4 * u, u, d]}
        materials={['white']}
      />
      {/* Middle arm — 4/5 width (shorter, opens right) */}
      <ViroBox
        position={[0, 0, 0]}
        scale={[3 * u, u, d]}
        materials={['white']}
      />
      {/* Bottom arm — full width */}
      <ViroBox
        position={[0.5 * u, -2 * u, 0]}
        scale={[4 * u, u, d]}
        materials={['white']}
      />
    </>
  );
}

function AcuityPanel({ optotype }) {
  if (!optotype) return null;

  // Map sizePx (18–180) → letter height in world metres at z = -4
  // sizePx × 0.004 → range 0.072 m (barely visible) to 0.72 m (large & clear)
  const H   = Math.max(0.06, optotype.sizePx * 0.004);
  const rot = optotype.rotation || 0;

  return (
    // z = -4: closer than original -6. At -6 the smallest letters were
    // sub-pixel on mobile VR displays; -4 keeps them in a testable range.
    <ViroNode position={[0, 0, -4]}>
      <FixCross />
      {/* Rotate the whole E around Z so 0° = opens-right, 90° = opens-down, etc. */}
      <ViroNode rotation={[0, 0, rot]}>
        <SnellenEBoxes H={H} />
      </ViroNode>
    </ViroNode>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Astigmatism clock dial
// ─────────────────────────────────────────────────────────────────────────────
function AstigmatismPanel() {
  const tickRing = useMemo(() =>
    Array.from({ length: 36 }, (_, i) => {
      const rad = (i * 10 * Math.PI) / 180;
      return (
        <ViroBox
          key={`ring-${i}`}
          position={[1.3 * Math.cos(rad), 1.3 * Math.sin(rad), 0]}
          scale={[0.04, 0.04, 0.02]}
          materials={['dimGrey']}
        />
      );
    }), []);

  return (
    <ViroNode position={[0, 0, -3.5]}>
      <ViroText
        text="Which lines look darkest?"
        position={[0, 1.65, 0]}
        scale={[0.13, 0.13, 0.13]}
        width={9}
        height={0.4}
        style={{ color: '#FFFFFF', fontSize: 30, textAlign: 'center' }}
      />
      {tickRing}
      {CLOCK_ANGLES.map(deg => (
        <ViroLineBox key={deg} length={2.55} angleDeg={deg} thickness={0.016} />
      ))}
      {CLOCK_ANGLES.map(deg => {
        const rad = (deg * Math.PI) / 180;
        return (
          <ViroText
            key={`lbl-${deg}`}
            text={deg === 0 ? '180' : String(deg)}
            position={[1.60 * Math.cos(rad), 1.60 * Math.sin(rad), 0]}
            scale={[0.075, 0.075, 0.075]}
            width={1}
            height={0.3}
            style={{ color: '#888888', fontSize: 22, textAlign: 'center' }}
          />
        );
      })}
      <ViroText
        text="Tell the assistant which line(s) appear thickest or darkest"
        position={[0, -1.68, 0]}
        scale={[0.09, 0.09, 0.09]}
        width={9}
        height={0.3}
        style={{ color: '#888888', fontSize: 22, textAlign: 'center' }}
      />
      <ViroBox position={[0, 0, 0.01]} scale={[0.055, 0.055, 0.055]} materials={['midGrey']} />
    </ViroNode>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Near vision Jaeger chart
// ─────────────────────────────────────────────────────────────────────────────
function NearPanel() {
  return (
    <ViroNode position={[0, 0, -1.0]}>
      <ViroText
        text="Near Vision"
        position={[0, 0.82, 0]}
        scale={[0.095, 0.095, 0.095]}
        width={4}
        height={0.28}
        style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '700', textAlign: 'center' }}
      />
      {NEAR_LINES.map(line => (
        <ViroNode key={line.label} position={[0, line.y, 0]}>
          <ViroText
            text={line.label}
            position={[-0.52, 0, 0]}
            scale={[line.s * 0.65, line.s * 0.65, line.s * 0.65]}
            width={1}
            height={0.3}
            style={{ color: '#888888', fontSize: 26, textAlign: 'right' }}
          />
          <ViroText
            text={line.text}
            position={[0.06, 0, 0]}
            scale={[line.s, line.s, line.s]}
            width={3.5}
            height={0.35}
            style={{ color: '#FFFFFF', fontSize: 36, fontWeight: '700', textAlign: 'left' }}
          />
        </ViroNode>
      ))}
      <ViroText
        text="Read the smallest line you can see clearly"
        position={[0, -0.63, 0]}
        scale={[0.065, 0.065, 0.065]}
        width={6}
        height={0.25}
        style={{ color: '#666666', fontSize: 22, textAlign: 'center' }}
      />
    </ViroNode>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ishihara colour plate
// ─────────────────────────────────────────────────────────────────────────────
function IshiharaPanel({ dots, plateIndex, totalPlates }) {
  const dotQuads = useMemo(() => {
    if (!dots?.length) return null;
    return dots.slice(0, 900).map((dot, i) => {
      const x = ((dot.cx - 100) / 100) * 1.2;
      const y = -((dot.cy - 100) / 100) * 1.2;
      const d = Math.max(0.022, (dot.r / 100) * 1.2 * 2);
      return (
        <ViroQuad
          key={`${i}-${dot.cx}-${dot.cy}`}
          position={[x, y, 0.001]}
          width={d}
          height={d}
          materials={[hexMat(dot.fill)]}
        />
      );
    });
  }, [dots]);

  return (
    <ViroNode position={[0, 0, -3.2]}>
      <ViroText
        text={`What number do you see?   (Plate ${plateIndex + 1} / ${totalPlates})`}
        position={[0, 1.62, 0]}
        scale={[0.12, 0.12, 0.12]}
        width={9}
        height={0.4}
        style={{ color: '#FFFFFF', fontSize: 28, textAlign: 'center' }}
      />
      <ViroQuad
        position={[0, 0, 0]}
        width={2.55}
        height={2.55}
        materials={['plateBg']}
      />
      {dotQuads}
    </ViroNode>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Feedback flash
// ─────────────────────────────────────────────────────────────────────────────
function FeedbackFlash({ visible, seen }) {
  if (!visible) return null;
  return (
    <ViroQuad
      position={[0, 0, -2.5]}
      scale={[8, 6, 1]}
      materials={[seen ? 'flashGreen' : 'flashRed']}
      opacity={0.16}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT SCENE
// ─────────────────────────────────────────────────────────────────────────────
export default function PatientViroPureScene(props) {

  // FIX 1: lazy one-shot material creation — runs AFTER Viro native engine
  // registers this scene component, guaranteeing the bridge is ready.
  const materialsCreated = useRef(false);
  if (!materialsCreated.current) {
    materialsCreated.current = true;
    try {
      ViroMaterials.createMaterials(ALL_MATERIAL_DEFS);
    } catch (e) {
      console.warn('[PatientViroPureScene] createMaterials error:', e);
    }
  }

  const {
    phase          = 'waiting',
    instruction    = 'Waiting for assistant...',
    optotype       = null,
    isComplete     = false,
    showLeft       = true,
    showRight      = true,
    colorShowLeft  = true,
    colorShowRight = true,
    nearShowLeft   = true,
    nearShowRight  = true,
    astigShowLeft  = true,
    astigShowRight = true,
    plateDots      = [],
    plateIndex     = 0,
    totalPlates    = 12,
    showFeedback   = false,
    feedbackSeen   = false,
  } = props.sceneNavigator?.viroAppProps ?? {};

  let showL = showLeft,
      showR = showRight;
  if (phase === 'color')       { showL = colorShowLeft;  showR = colorShowRight; }
  if (phase === 'near')        { showL = nearShowLeft;   showR = nearShowRight; }
  if (phase === 'astigmatism') { showL = astigShowLeft;  showR = astigShowRight; }

  return (
    <ViroScene>

      {/* Full-scene black background */}
      <ViroQuad
        position={[0, 0, -25]}
        scale={[80, 60, 1]}
        materials={['sceneBg']}
      />

      {isComplete && <CompletePanel />}

      {!isComplete && phase === 'waiting' && (
        <WaitingPanel text={instruction} />
      )}

      {!isComplete && phase === 'acuity' && (
        <>
          <EyeGuide showL={showL} showR={showR} />
          <AcuityPanel optotype={optotype} />
        </>
      )}

      {!isComplete && phase === 'astigmatism' && (
        <>
          <EyeGuide showL={showL} showR={showR} />
          <AstigmatismPanel />
        </>
      )}

      {!isComplete && phase === 'near' && (
        <>
          <EyeGuide showL={showL} showR={showR} />
          <NearPanel />
        </>
      )}

      {!isComplete && phase === 'color' && (
        <>
          <EyeGuide showL={showL} showR={showR} />
          <IshiharaPanel
            dots={plateDots}
            plateIndex={plateIndex}
            totalPlates={totalPlates}
          />
        </>
      )}

      <FeedbackFlash visible={showFeedback} seen={feedbackSeen} />

    </ViroScene>
  );
}