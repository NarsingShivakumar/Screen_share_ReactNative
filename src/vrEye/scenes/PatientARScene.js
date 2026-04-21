/**
 * PatientARScene.js  — @reactvision/react-viro  (AR mode)
 *
 * Reuses the same panel components from PatientVRScene but wraps them in
 * ViroARScene so the phone camera becomes the background.
 *
 * AR-specific differences vs VR:
 *   • Background = live camera (ViroARSceneNavigator handles this)
 *   • Panels have semi-transparent dark backgrounds (not pitch black)
 *   • Content floats at z = -2 m (closer — AR feels natural at arm's length)
 *   • Ambient tracking light responds to real environment
 *   • Scale slightly smaller (1.2 m wide) — AR panels shouldn't dominate the view
 *
 * Usage in PatientScreen.js:
 *   <ViroARSceneNavigator
 *     style={StyleSheet.absoluteFill}
 *     initialScene={{ scene: PatientARScene }}
 *     viroAppProps={viroAppProps}
 *   />
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import {
  ViroARScene,
  ViroFlexView,
  ViroAmbientLight,
  ViroSpotLight,
  ViroQuad,
  ViroMaterials,
  ViroNode,
} from '@reactvision/react-viro';

// ── AR constants ──────────────────────────────────────────────────────────────
const Z_AR      = -2;          // closer in AR
const EYE_OFF   = 0.60;
const PW_AR     = 1.2;
const PH_AR     = 1.4;

const NEAR_LINES_AR = [
  { label: 'N24', text: 'E',                fs: 40 },
  { label: 'N18', text: 'F  P',             fs: 30 },
  { label: 'N14', text: 'T  O  Z',          fs: 22 },
  { label: 'N10', text: 'L  P  E  D',       fs: 16 },
  { label: 'N8',  text: 'P  E  C  F  D',    fs: 12 },
  { label: 'N5',  text: 'H  N  O  R  C  V', fs: 9  },
];

const CLOCK_ANGLES = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165];

ViroMaterials.createMaterials({
  arOccluder: { diffuseColor: '#000000', lightingModel: 'Constant' },
  arFeedGreen:{ diffuseColor: '#00DD55', lightingModel: 'Constant' },
  arFeedRed:  { diffuseColor: '#DD2200', lightingModel: 'Constant' },
});

// ── Shared AR panel wrapper ───────────────────────────────────────────────────
function ARPanel({ position, children }) {
  return (
    <ViroFlexView
      position={position}
      width={PW_AR}
      height={PH_AR}
      style={ar.flexWrap}
    >
      <View style={ar.panel}>{children}</View>
    </ViroFlexView>
  );
}

function AREyePanels({ showLeft, showRight, children }) {
  return (
    <>
      {showLeft ? (
        <ARPanel position={[-EYE_OFF, 0, Z_AR]}>{children}</ARPanel>
      ) : (
        <ViroQuad position={[-EYE_OFF, 0, Z_AR]} scale={[PW_AR, PH_AR, 1]} materials={['arOccluder']} />
      )}
      {showRight ? (
        <ARPanel position={[EYE_OFF, 0, Z_AR]}>{children}</ARPanel>
      ) : (
        <ViroQuad position={[EYE_OFF, 0, Z_AR]} scale={[PW_AR, PH_AR, 1]} materials={['arOccluder']} />
      )}
    </>
  );
}

// ── AR eye-cover banner ───────────────────────────────────────────────────────
function AREyeBanner({ showLeft, showRight }) {
  if (showLeft && showRight) return null;
  const msg = showLeft ? '👁  Open LEFT eye only' : '👁  Open RIGHT eye only';
  return (
    <ViroFlexView position={[0, 0.76, Z_AR]} width={2.2} height={0.2} style={ar.bannerFlex}>
      <View style={ar.bannerInner}>
        <Text style={ar.bannerText}>{msg}</Text>
      </View>
    </ViroFlexView>
  );
}

// ── Phases ────────────────────────────────────────────────────────────────────
function ARWaiting({ instruction, showLeft, showRight }) {
  return (
    <AREyePanels showLeft={showLeft} showRight={showRight}>
      <View style={ar.center}>
        <Text style={ar.title}>Vision Screening</Text>
        <View style={ar.divider} />
        <Text style={ar.body}>{instruction}</Text>
      </View>
    </AREyePanels>
  );
}

function ARAcuity({ optotype, showLeft, showRight }) {
  const fontSize = optotype ? Math.max(14, Math.round(optotype.sizePx * 0.75)) : 40;
  const rotation = optotype?.rotation ?? 0;
  const label    = optotype?.acuityLabel ?? '';
  return (
    <AREyePanels showLeft={showLeft} showRight={showRight}>
      <View style={ar.center}>
        <Text style={ar.acuityLabel}>{label}</Text>
        <View style={ar.eBox}>
          <Text style={[ar.optotypeE, { fontSize, transform: [{ rotate: `${rotation}deg` }] }]}>
            E
          </Text>
        </View>
        <View style={ar.dirRow}>
          {['↑','↓','←','→'].map(d => (
            <Text key={d} style={ar.dirHint}>{d}</Text>
          ))}
        </View>
      </View>
    </AREyePanels>
  );
}

function ARAstig({ astigShowLeft, astigShowRight }) {
  const dial = useMemo(() => (
    <Svg width={240} height={240} viewBox="-5 -5 110 110">
      <Circle cx="50" cy="50" r="48" stroke="#555" strokeWidth="0.8" fill="none" />
      {CLOCK_ANGLES.map(angle => {
        const rad = (angle * Math.PI) / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        return (
          <Line
            key={angle}
            x1={50 + 46 * cos} y1={50 + 46 * sin}
            x2={50 - 46 * cos} y2={50 - 46 * sin}
            stroke="#FFFFFF" strokeWidth="1.4"
          />
        );
      })}
      <Circle cx="50" cy="50" r="2" fill="#666" />
    </Svg>
  ), []);
  return (
    <AREyePanels showLeft={astigShowLeft} showRight={astigShowRight}>
      <View style={ar.center}>
        <Text style={ar.title}>Astigmatism</Text>
        <Text style={ar.sub}>Which lines appear darkest?</Text>
        <View style={ar.svgWrap}>{dial}</View>
      </View>
    </AREyePanels>
  );
}

function ARColor({ plateDots, plateConfig, colorShowLeft, colorShowRight }) {
  const plate = useMemo(() => {
    if (!plateDots?.length) return null;
    return (
      <Svg width={260} height={260} viewBox="8 8 184 184">
        <Circle cx="100" cy="100" r="92" fill="#888" opacity={0.08} />
        {plateDots.map((dot) => (
          <Circle
            key={`${dot.cx.toFixed(1)},${dot.cy.toFixed(1)}`}
            cx={dot.cx} cy={dot.cy} r={dot.r} fill={dot.fill}
          />
        ))}
      </Svg>
    );
  }, [plateDots]);
  return (
    <AREyePanels showLeft={colorShowLeft} showRight={colorShowRight}>
      <View style={ar.center}>
        <Text style={ar.title}>Colour Vision</Text>
        <Text style={ar.sub}>What number do you see?</Text>
        <View style={ar.svgWrap}>{plate}</View>
        <Text style={ar.badge}>Plate {plateConfig?.plateNum ?? ''}</Text>
      </View>
    </AREyePanels>
  );
}

function ARNear({ nearShowLeft, nearShowRight }) {
  return (
    <AREyePanels showLeft={nearShowLeft} showRight={nearShowRight}>
      <View style={[ar.center, { justifyContent: 'flex-start', paddingTop: 12 }]}>
        <Text style={ar.title}>Near Vision</Text>
        {NEAR_LINES_AR.map(line => (
          <View key={line.label} style={ar.nearRow}>
            <Text style={ar.nearLabel}>{line.label}</Text>
            <Text style={[ar.nearText, { fontSize: line.fs }]}>{line.text}</Text>
          </View>
        ))}
      </View>
    </AREyePanels>
  );
}

function ARComplete() {
  return (
    <ViroFlexView position={[0, 0, Z_AR]} width={2.2} height={1.0} style={ar.flexWrap}>
      <View style={[ar.panel, ar.completePanel]}>
        <Text style={ar.completeIcon}>✓</Text>
        <Text style={ar.completeTitle}>Test Complete</Text>
        <Text style={ar.completeBody}>Please remove the headset</Text>
      </View>
    </ViroFlexView>
  );
}

// ── Root AR Scene ─────────────────────────────────────────────────────────────
export default function PatientARScene(props) {
  const p = props.sceneNavigator.viroAppProps;
  const {
    phase, instruction, optotype,
    showLeft = true, showRight = true,
    colorShowLeft = true, colorShowRight = true,
    nearShowLeft = true, nearShowRight = true,
    astigShowLeft = true, astigShowRight = true,
    plateDots = [], plateConfig,
    showFeedback = false, feedbackSeen = false,
    isComplete = false,
  } = p;

  return (
    <ViroARScene>
      {/* Ambient + spot light for AR environment awareness */}
      <ViroAmbientLight color="#FFFFFF" intensity={1200} />

      <AREyeBanner showLeft={showLeft} showRight={showRight} />

      {(phase === 'waiting' || !phase) && !isComplete && (
        <ARWaiting instruction={instruction} showLeft={showLeft} showRight={showRight} />
      )}
      {phase === 'acuity'      && <ARAcuity  optotype={optotype} showLeft={showLeft} showRight={showRight} />}
      {phase === 'astigmatism' && <ARAstig   astigShowLeft={astigShowLeft} astigShowRight={astigShowRight} />}
      {phase === 'color'       && <ARColor   plateDots={plateDots} plateConfig={plateConfig} colorShowLeft={colorShowLeft} colorShowRight={colorShowRight} />}
      {phase === 'near'        && <ARNear    nearShowLeft={nearShowLeft} nearShowRight={nearShowRight} />}
      {isComplete              && <ARComplete />}

      {showFeedback && (
        <ViroQuad
          position={[0, 0, Z_AR + 0.4]}
          scale={[5, 4, 1]}
          materials={[feedbackSeen ? 'arFeedGreen' : 'arFeedRed']}
          opacity={0.15}
        />
      )}
    </ViroARScene>
  );
}

// ── AR styles ─────────────────────────────────────────────────────────────────
const ar = StyleSheet.create({
  flexWrap: { backgroundColor: 'transparent' },
  panel: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(68,153,255,0.3)',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  title: {
    color: '#4499FF', fontSize: 13, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2,
  },
  sub: { color: '#999', fontSize: 10, marginBottom: 6, textAlign: 'center' },
  body: { color: '#DDD', fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 6 },
  divider: { width: 50, height: 1, backgroundColor: '#333', marginVertical: 8 },
  acuityLabel: { color: '#555', fontSize: 10, letterSpacing: 1, marginBottom: 3 },
  eBox: { alignItems: 'center', justifyContent: 'center', minWidth: 60, minHeight: 60 },
  optotypeE: {
    color: '#FFFFFF', fontFamily: 'monospace',
    fontWeight: '900', textAlign: 'center',
  },
  dirRow: { flexDirection: 'row', marginTop: 10, gap: 10 },
  dirHint: { color: '#444', fontSize: 12 },
  svgWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 2 },
  badge: { color: '#444', fontSize: 9, marginTop: 3, letterSpacing: 1 },
  nearRow: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 6, paddingVertical: 1 },
  nearLabel: { color: '#444', fontSize: 7, width: 30, textAlign: 'right', marginRight: 6 },
  nearText: { color: '#FFF', fontFamily: 'monospace', letterSpacing: 1, flexShrink: 1 },
  completePanel: { backgroundColor: 'rgba(0,26,0,0.9)' },
  completeIcon: { color: '#00DD55', fontSize: 40, marginBottom: 4 },
  completeTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 2 },
  completeBody: { color: '#888', fontSize: 11, marginTop: 2 },
  bannerFlex: { backgroundColor: 'transparent' },
  bannerInner: {
    flex: 1, backgroundColor: 'rgba(0,80,200,0.88)',
    alignItems: 'center', justifyContent: 'center', borderRadius: 5,
  },
  bannerText: { color: '#FFF', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});
