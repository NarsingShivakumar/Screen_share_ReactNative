/**
 * PatientVRScene.js  —  @reactvision/react-viro  (VR-only, JS)
 *
 * WHY THE OLD OPTOTYPE WAS INVISIBLE:
 *   - ViroText at scale 0.045 is sub-millimetre in world-space — invisible.
 *   - "Ш" is not a Snellen E.
 *   - EyeCover quad accidentally overlapped the test content at z=-0.3.
 *
 * PRODUCTION FIX:
 *   - All test content rendered as ViroFlexView (React Native view → 3D texture).
 *   - ViroText is used only for tiny overlay labels (depth, instruction).
 *   - Correct viewing distances:  acuity z=-6  |  near z=-0.5  |  color/astig z=-3
 *   - Eye-cover: colored side-strip quad + text instruction (reliable cross-device).
 *
 * DEPENDENCIES:  @reactvision/react-viro  react-native-svg
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Circle as SvgCircle,
  Line   as SvgLine,
  Text   as SvgText,
  Rect   as SvgRect,
} from 'react-native-svg';
import {
  ViroScene,
  ViroFlexView,
  ViroText,
  ViroNode,
  ViroQuad,
  ViroMaterials,
} from '@reactvision/react-viro';

// ─────────────────────────────────────────────────────────────────────────────
// Materials (created once at module load)
// ─────────────────────────────────────────────────────────────────────────────
ViroMaterials.createMaterials({
  darkBg:       { diffuseColor: '#050505', lightingModel: 'Constant' },
  flashGreen:   { diffuseColor: '#00FF88', lightingModel: 'Constant' },
  flashRed:     { diffuseColor: '#FF3333', lightingModel: 'Constant' },
  coverLeft:    { diffuseColor: '#FF3333', lightingModel: 'Constant' },
  coverRight:   { diffuseColor: '#3388FF', lightingModel: 'Constant' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
// Near-vision Jaeger chart.  fontSize values are in React-Native dp units
// rendered into the ViroFlexView texture (treated as if the panel is ~400dp wide).
const NEAR_LINES = [
  { label: 'N24', text: 'E',               fs: 64 },
  { label: 'N18', text: 'F  P',            fs: 48 },
  { label: 'N14', text: 'T  O  Z',         fs: 36 },
  { label: 'N10', text: 'L  P  E  D',      fs: 26 },
  { label: 'N8',  text: 'P  E  C  F  D',   fs: 20 },
  { label: 'N5',  text: 'H  N  O  R  C',   fs: 15 },
];

// Astigmatism clock-dial angles (degrees).
const CLOCK_ANGLES = [0, 30, 60, 90, 120, 150];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Convert left/right visibility booleans to an eye label for the instruction. */
function eyeLabel(showL, showR) {
  if (showL && showR)  return 'both';
  if (showL)           return 'left';
  if (showR)           return 'right';
  return 'both';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-panels
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Eye instruction + coloured side-strip.
 * Red strip on left  = "Cover your LEFT eye" (testing right).
 * Blue strip on right = "Cover your RIGHT eye" (testing left).
 */
function EyeGuide({ showLeft, showRight }) {
  const eye = eyeLabel(showLeft, showRight);
  if (eye === 'both') return null;

  const isTesting  = eye;                              // 'left' | 'right'
  const coverSide  = eye === 'left' ? 'RIGHT' : 'LEFT';
  const stripMat   = eye === 'left' ? 'coverRight' : 'coverLeft';
  const stripX     = eye === 'left' ?  2.6 : -2.6;    // far side of view
  const labelColor = eye === 'left' ? '#88CCFF' : '#FF8888';

  return (
    <>
      {/* Thin coloured strip on the eye-to-cover side */}
      <ViroQuad
        position={[stripX, 0, -4]}
        scale={[0.15, 3.5, 1]}
        materials={[stripMat]}
        opacity={0.7}
      />
      {/* Text instruction */}
      <ViroFlexView
        position={[0, 1.6, -4]}
        width={3.5}
        height={0.3}
        style={sc.instrBg}
      >
        <View style={sc.instrRow}>
          <Text style={[sc.instrText, { color: labelColor }]}>
            ▶  Cover your {coverSide} eye  ◀
          </Text>
        </View>
      </ViroFlexView>
    </>
  );
}

/**
 * Waiting / instruction panel — shown while phase is 'waiting' or
 * when no optotype has arrived yet.
 */
function WaitingPanel({ text }) {
  return (
    <ViroFlexView position={[0, 0, -4]} width={4.5} height={1.2} style={sc.waitBg}>
      <View style={sc.waitInner}>
        <Text style={sc.waitText}>{text}</Text>
      </View>
    </ViroFlexView>
  );
}

/** Test-complete screen */
function CompletePanel() {
  return (
    <ViroFlexView position={[0, 0, -4]} width={4} height={1.8} style={sc.completeBg}>
      <View style={sc.completeInner}>
        <Text style={sc.completeTitle}>✓  Test Complete</Text>
        <Text style={sc.completeSub}>Please remove the headset</Text>
      </View>
    </ViroFlexView>
  );
}

/**
 * FAR VISION / ACUITY (Snellen E)
 * Panels placed at z=-6 m (20 ft equivalent).  Panel size = 3 m × 3 m.
 *
 * sizePx drives fontSize inside the ViroFlexView texture buffer.
 * At z=-6, a 3 m panel subtends ≈ 28 °.  fontSize is proportional to sizePx,
 * giving angular sizes matching the original screen proportions.
 *
 * The Snellen E is rendered in white on black.  Rotation is applied via
 * React Native transform so the letter can point up / down / left / right.
 */
function AcuityPanels({ optotype, showLeft, showRight }) {
  if (!optotype) return null;
  if (!showLeft && !showRight) return null;

  // Map sizePx (18–180) into a font-size for the ViroFlexView texture.
  // Multiply by ≈ 2.8 so the letter fills a good proportion of the 3 m panel.
  const fontSize = Math.max(24, Math.round(optotype.sizePx * 2.8));
  const rotation = optotype.rotation ?? 0;

  const panel = (posX, key) => (
    <ViroFlexView
      key={key}
      position={[posX, 0, -6]}
      width={3}
      height={3}
      style={sc.darkPanel}
    >
      <View style={sc.panelCenter}>
        {/* White fixation cross */}
        <View style={sc.fixCrossH} />
        <View style={sc.fixCrossV} />
        {/* Snellen E rotated */}
        <View style={{ transform: [{ rotate: `${rotation}deg` }] }}>
          <Text style={[sc.optoE, { fontSize }]}>E</Text>
        </View>
      </View>
    </ViroFlexView>
  );

  return (
    <>
      {showLeft  && panel(-1.55, 'ac-L')}
      {showRight && panel( 1.55, 'ac-R')}
    </>
  );
}

/**
 * ASTIGMATISM  —  clock dial with 6 lines at 30° intervals.
 * Placed at z=-3 m.
 */
function AstigmatismPanels({ showLeft, showRight }) {
  if (!showLeft && !showRight) return null;

  const panel = (posX, key) => (
    <ViroFlexView
      key={key}
      position={[posX, 0, -3]}
      width={2.2}
      height={2.5}
      style={sc.darkPanel}
    >
      <View style={sc.panelCenter}>
        <Text style={sc.testHeading}>Which lines look darkest?</Text>
        <Svg width={260} height={260} viewBox="-5 -5 110 110">
          {/* Outer ring */}
          <SvgCircle cx={50} cy={50} r={48} stroke="#2a2a2a" strokeWidth={1} fill="#0a0a0a" />
          {/* Degree scale ticks */}
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            return (
              <SvgLine
                key={`tick-${i}`}
                x1={50 + 44 * Math.cos(a)} y1={50 + 44 * Math.sin(a)}
                x2={50 + 48 * Math.cos(a)} y2={50 + 48 * Math.sin(a)}
                stroke="#444" strokeWidth={0.8}
              />
            );
          })}
          {/* 6 main clock lines */}
          {CLOCK_ANGLES.map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const x1 = 50 + 42 * Math.cos(rad);
            const y1 = 50 + 42 * Math.sin(rad);
            const x2 = 50 - 42 * Math.cos(rad);
            const y2 = 50 - 42 * Math.sin(rad);
            return (
              <SvgLine
                key={`cl-${deg}`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#FFFFFF" strokeWidth={2.5}
                strokeLinecap="round"
              />
            );
          })}
          {/* Angle labels */}
          {CLOCK_ANGLES.map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const lx = 50 + 54 * Math.cos(rad);
            const ly = 50 + 54 * Math.sin(rad);
            const label = deg === 0 ? '180' : String(deg);
            return (
              <SvgText
                key={`lb-${deg}`}
                x={lx} y={ly + 1.5}
                fill="#888888" fontSize={4.5}
                textAnchor="middle" alignmentBaseline="middle"
              >
                {label}°
              </SvgText>
            );
          })}
          {/* Centre dot */}
          <SvgCircle cx={50} cy={50} r={1.5} fill="#555" />
        </Svg>
      </View>
    </ViroFlexView>
  );

  return (
    <>
      {showLeft  && panel(-1.1, 'as-L')}
      {showRight && panel( 1.1, 'as-R')}
    </>
  );
}

/**
 * COLOUR VISION  —  Ishihara dot plate.
 * Dots pre-computed by generatePlateDots(); rendered as react-native-svg circles.
 * Placed at z=-3 m.
 */
function IshiharaPanels({ dots, showLeft, showRight }) {
  if (!dots?.length || (!showLeft && !showRight)) return null;

  // Memoise the SVG circles so they don't recompute unless dots change.
  const circles = useMemo(
    () =>
      dots.map((dot) => (
        <SvgCircle
          key={`${dot.cx.toFixed(2)}-${dot.cy.toFixed(2)}`}
          cx={dot.cx} cy={dot.cy} r={dot.r}
          fill={dot.fill}
        />
      )),
    [dots],
  );

  const panel = (posX, key) => (
    <ViroFlexView
      key={key}
      position={[posX, 0, -3]}
      width={2.2}
      height={2.5}
      style={sc.darkPanel}
    >
      <View style={sc.panelCenter}>
        <Text style={sc.testHeading}>What number do you see?</Text>
        <View style={sc.svgWrap}>
          <Svg width={270} height={270} viewBox="0 0 200 200">
            {/* Plate border circle (grey rim, like a real Ishihara book) */}
            <SvgCircle cx={100} cy={100} r={97} fill="#1a1a1a" />
            <SvgCircle cx={100} cy={100} r={95} fill="#1c1c1c" stroke="#333" strokeWidth={0.5} />
            {circles}
          </Svg>
        </View>
      </View>
    </ViroFlexView>
  );

  return (
    <>
      {showLeft  && panel(-1.1, 'ish-L')}
      {showRight && panel( 1.1, 'ish-R')}
    </>
  );
}

/**
 * NEAR VISION  —  Jaeger reading chart.
 * Placed at z=-0.5 m (50 cm — near reading distance).
 * Panel is 0.5 m × 0.6 m (very close, so small panel still looks large).
 */
function NearVisionPanels({ showLeft, showRight }) {
  if (!showLeft && !showRight) return null;

  const panel = (posX, key) => (
    <ViroFlexView
      key={key}
      position={[posX, 0, -0.5]}
      width={0.52}
      height={0.62}
      style={sc.nearBg}
    >
      <View style={sc.nearInner}>
        <Text style={sc.nearTitle}>Near Vision</Text>
        {NEAR_LINES.map((line) => (
          <View key={line.label} style={sc.nearRow}>
            <Text style={sc.nearLabel}>{line.label}</Text>
            <Text style={[sc.nearText, { fontSize: line.fs }]}>{line.text}</Text>
          </View>
        ))}
      </View>
    </ViroFlexView>
  );

  return (
    <>
      {showLeft  && panel(-0.27, 'nv-L')}
      {showRight && panel( 0.27, 'nv-R')}
    </>
  );
}

/** Semi-transparent colour flash on correct / incorrect response. */
function FeedbackFlash({ visible, seen }) {
  if (!visible) return null;
  return (
    <ViroQuad
      position={[0, 0, -2.5]}
      scale={[7, 5, 1]}
      materials={[seen ? 'flashGreen' : 'flashRed']}
      opacity={0.18}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root VR Scene
// ─────────────────────────────────────────────────────────────────────────────
export default function PatientVRScene(props) {
  // viroAppProps is injected by ViroVRSceneNavigator via the viroAppProps prop.
  const {
    phase         = 'waiting',
    instruction   = 'Waiting for assistant…',
    optotype      = null,
    isComplete    = false,
    showLeft      = true,
    showRight     = true,
    colorShowLeft  = true,
    colorShowRight = true,
    nearShowLeft   = true,
    nearShowRight  = true,
    astigShowLeft  = true,
    astigShowRight = true,
    plateDots     = [],
    showFeedback  = false,
    feedbackSeen  = false,
  } = props.sceneNavigator?.viroAppProps ?? {};

  const isAcuity  = phase === 'acuity';
  const isAstig   = phase === 'astigmatism';
  const isColor   = phase === 'color';
  const isNear    = phase === 'near';
  const isWaiting = !isAcuity && !isAstig && !isColor && !isNear && !isComplete;

  return (
    <ViroScene>

      {/* ── Full-scene black background (large far quad) ────────────────── */}
      <ViroQuad
        position={[0, 0, -25]}
        scale={[80, 60, 1]}
        materials={['darkBg']}
      />

      {/* ── TEST COMPLETE ─────────────────────────────────────────────── */}
      {isComplete && <CompletePanel />}

      {/* ── WAITING / INSTRUCTION ─────────────────────────────────────── */}
      {!isComplete && isWaiting && (
        <WaitingPanel text={instruction} />
      )}

      {/* ── FAR VISION  (Acuity / Snellen E) ─────────────────────────── */}
      {!isComplete && isAcuity && (
        <>
          <EyeGuide showLeft={showLeft} showRight={showRight} />
          {optotype
            ? <AcuityPanels optotype={optotype} showLeft={showLeft} showRight={showRight} />
            : <WaitingPanel text={instruction} />
          }
        </>
      )}

      {/* ── ASTIGMATISM  (clock dial) ──────────────────────────────────── */}
      {!isComplete && isAstig && (
        <>
          <EyeGuide showLeft={astigShowLeft} showRight={astigShowRight} />
          <AstigmatismPanels showLeft={astigShowLeft} showRight={astigShowRight} />
        </>
      )}

      {/* ── COLOUR VISION  (Ishihara) ──────────────────────────────────── */}
      {!isComplete && isColor && (
        <>
          <EyeGuide showLeft={colorShowLeft} showRight={colorShowRight} />
          <IshiharaPanels
            dots={plateDots}
            showLeft={colorShowLeft}
            showRight={colorShowRight}
          />
        </>
      )}

      {/* ── NEAR VISION  (Jaeger reading chart) ─────────────────────── */}
      {!isComplete && isNear && (
        <>
          <EyeGuide showLeft={nearShowLeft} showRight={nearShowRight} />
          <NearVisionPanels showLeft={nearShowLeft} showRight={nearShowRight} />
        </>
      )}

      {/* ── RESPONSE FEEDBACK FLASH ───────────────────────────────────── */}
      <FeedbackFlash visible={showFeedback} seen={feedbackSeen} />

    </ViroScene>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StyleSheet
// ─────────────────────────────────────────────────────────────────────────────
const sc = StyleSheet.create({

  // ── Shared panel base ────────────────────────────────────────────────────
  darkPanel: {
    backgroundColor: '#080808',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelCenter: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  // ── Waiting panel ────────────────────────────────────────────────────────
  waitBg: {
    backgroundColor: '#0d0d0d',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  waitText: {
    color: '#CCCCCC',
    fontSize: 22,
    textAlign: 'center',
    lineHeight: 32,
    fontFamily: 'System',
  },

  // ── Instruction bar (eye guide) ──────────────────────────────────────────
  instrBg: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instrRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instrText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // ── Complete panel ───────────────────────────────────────────────────────
  completeBg: {
    backgroundColor: '#0a1a0a',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  completeInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  completeTitle: {
    color: '#44FF88',
    fontSize: 44,
    fontWeight: '700',
    marginBottom: 12,
  },
  completeSub: {
    color: '#AAAAAA',
    fontSize: 24,
  },

  // ── Acuity / Snellen E ───────────────────────────────────────────────────
  optoE: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontFamily: 'System',
    // fontSize injected at runtime from sizePx
  },
  // Fixation cross — two thin white rectangles in the background
  fixCrossH: {
    position: 'absolute',
    width: 40,
    height: 2,
    backgroundColor: '#333333',
  },
  fixCrossV: {
    position: 'absolute',
    width: 2,
    height: 40,
    backgroundColor: '#333333',
  },

  // ── Test heading (color, astigmatism panels) ─────────────────────────────
  testHeading: {
    color: '#AAAAAA',
    fontSize: 15,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // ── Ishihara plate ───────────────────────────────────────────────────────
  svgWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Near vision chart ────────────────────────────────────────────────────
  nearBg: {
    backgroundColor: '#FAFAF0',   // off-white — mimics real reading chart paper
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  nearInner: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
  },
  nearTitle: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  nearRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  nearLabel: {
    color: '#999999',
    fontSize: 10,
    width: 36,
    fontFamily: 'System',
  },
  nearText: {
    color: '#111111',
    fontFamily: 'System',
    fontWeight: '400',
    // fontSize injected at runtime per line
  },
});
