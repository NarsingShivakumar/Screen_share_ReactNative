/**
 * StereoOverlay.jsx
 * Renders two side-by-side RN panels (left eye / right eye) as a stereo display.
 * Sits above the ViroVRSceneNavigator using StyleSheet.absoluteFill + pointerEvents="none".
 *
 * Why this approach:
 *   ViroFlexView children must be Viro-native nodes.
 *   Placing ReactViewGroup (RN View) inside ViroNode crashes on Android.
 *   absoluteFill overlay avoids the Viro renderer entirely for 2D content.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

const BG = '#0a0a14';

// ── Sub-panels ─────────────────────────────────────────────────────────────────

const WaitingPanel = ({ instruction, patientName }) => (
  <View style={s.center}>
    <Text style={s.instruction}>{instruction}</Text>
    {!!patientName && <Text style={s.patientLabel}>Patient: {patientName}</Text>}
  </View>
);

const CompletePanel = () => (
  <View style={s.center}>
    <Text style={s.completeTitle}>✓ Test Complete</Text>
    <Text style={s.completeSub}>Please remove the headset</Text>
  </View>
);

const OptotypePanel = ({ optotype, show }) => {
  if (!optotype || !show) return <View style={s.center}><Text style={s.coverText}>●</Text></View>;
  return (
    <View style={s.center}>
      <Text style={[s.optotype, {
        fontSize: optotype.sizePx,
        transform: [{ rotate: `${optotype.rotation}deg` }],
      }]}>
        {optotype.letter}
      </Text>
      <Text style={s.acuityLabel}>{optotype.acuityLabel}</Text>
    </View>
  );
};

const IshiharaPanel = ({ dots, config, show }) => {
  if (!show) return <View style={s.center}><Text style={s.coverText}>●</Text></View>;
  return (
    <View style={s.center}>
      <Svg width={190} height={190} viewBox="0 0 200 200">
        <Circle cx={100} cy={100} r={92} fill="#e8e8e8" />
        {dots.map((d, i) => (
          <Circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={d.fill} />
        ))}
      </Svg>
      {config && (
        <Text style={s.plateLabel}>Plate {config.plateNum}</Text>
      )}
    </View>
  );
};

const NearVisionPanel = ({ lines, fontSizes, show }) => {
  if (!show) return <View style={s.center}><Text style={s.coverText}>●</Text></View>;
  return (
    <View style={s.center}>
      {lines.map((l, i) => (
        <View key={l.label} style={s.nearRow}>
          <Text style={s.nearLabel}>{l.label}</Text>
          <Text style={[s.nearText, { fontSize: fontSizes[i] ?? 8 }]}>{l.text}</Text>
        </View>
      ))}
    </View>
  );
};

const AstigmatismPanel = ({ clockAngles, show }) => {
  if (!show) return <View style={s.center}><Text style={s.coverText}>●</Text></View>;
  return (
    <View style={s.center}>
      <Text style={s.astigPrompt}>Which lines appear darkest?</Text>
      <Svg width={160} height={160} viewBox="0 0 100 100" style={{ marginTop: 8 }}>
        {clockAngles.map(a => {
          const rad = (a * Math.PI) / 180;
          return (
            <Line
              key={a}
              x1={50 + 42 * Math.cos(rad)} y1={50 + 42 * Math.sin(rad)}
              x2={50 - 42 * Math.cos(rad)} y2={50 - 42 * Math.sin(rad)}
              stroke="white" strokeWidth={1.8}
            />
          );
        })}
      </Svg>
    </View>
  );
};

// ── Single eye panel ───────────────────────────────────────────────────────────

const EyePanel = ({
  phase, isComplete, instruction, patientName,
  optotype, showLeft, showRight,
  colorShowLeft, colorShowRight,
  nearShowLeft, nearShowRight,
  astigShowLeft, astigShowRight,
  currentPlateDots, currentPlateConfig,
  clockAngles, nearLines, nearFontSizes,
  showFeedback, feedbackSeen,
  isLeft,
}) => {
  const show      = isLeft ? showLeft       : showRight;
  const colorShow = isLeft ? colorShowLeft  : colorShowRight;
  const nearShow  = isLeft ? nearShowLeft   : nearShowRight;
  const astigShow = isLeft ? astigShowLeft  : astigShowRight;

  return (
    <View style={s.panel}>
      {/* Divider line (left panel only) */}
      {isLeft && <View style={s.divider} />}

      {isComplete
        ? <CompletePanel />
        : phase === 'acuity'
          ? <OptotypePanel optotype={optotype} show={show} />
          : phase === 'color'
            ? <IshiharaPanel dots={currentPlateDots} config={currentPlateConfig} show={colorShow} />
            : phase === 'near'
              ? <NearVisionPanel lines={nearLines} fontSizes={nearFontSizes} show={nearShow} />
              : phase === 'astigmatism'
                ? <AstigmatismPanel clockAngles={clockAngles} show={astigShow} />
                : <WaitingPanel instruction={instruction} patientName={patientName} />
      }

      {/* Response feedback dot */}
      {showFeedback && (
        <View style={[s.feedbackDot, { backgroundColor: feedbackSeen ? '#00cc66' : '#cc2244' }]} />
      )}
    </View>
  );
};

// ── Stereo overlay (left + right) ──────────────────────────────────────────────

const StereoOverlay = (props) => (
  <View style={s.stereo} pointerEvents="none">
    <EyePanel {...props} isLeft={true} />
    <EyePanel {...props} isLeft={false} />
  </View>
);

export default StereoOverlay;

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  stereo:       { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  panel:        { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  divider:      { position: 'absolute', right: 0, top: '10%', bottom: '10%', width: 1, backgroundColor: '#1e1e2e' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%', padding: 16 },

  // Optotype
  optotype:     { color: '#ffffff', fontWeight: '800', fontFamily: 'Courier', textAlign: 'center' },
  acuityLabel:  { color: '#334455', fontSize: 9, marginTop: 6, letterSpacing: 1 },
  coverText:    { color: '#111122', fontSize: 24 },

  // Ishihara
  plateLabel:   { color: '#1e1e2e', fontSize: 9, marginTop: 4 },

  // Near vision
  nearRow:      { flexDirection: 'row', alignItems: 'baseline', marginBottom: 3 },
  nearLabel:    { color: '#2a2a3a', fontSize: 8, width: 28, textAlign: 'right', marginRight: 6, letterSpacing: 0.5 },
  nearText:     { color: '#ffffff', fontFamily: 'Courier', letterSpacing: 3 },

  // Astigmatism
  astigPrompt:  { color: '#aaaaaa', fontSize: 11, textAlign: 'center', letterSpacing: 0.5 },

  // Waiting
  instruction:  { color: '#cccccc', fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 220 },
  patientLabel: { color: '#445566', fontSize: 10, marginTop: 8 },

  // Complete
  completeTitle:{ color: '#00cc88', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  completeSub:  { color: '#667788', fontSize: 12, marginTop: 6 },

  // Feedback
  feedbackDot:  {
    position: 'absolute', bottom: 24, alignSelf: 'center',
    width: 14, height: 14, borderRadius: 7,
  },
});