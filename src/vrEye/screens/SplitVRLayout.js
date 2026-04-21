import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const HALF = width / 2;

const NEAR_LINES = [
  { label: 'N24', text: 'E', size: 64 },
  { label: 'N18', text: 'F P', size: 48 },
  { label: 'N14', text: 'T O Z', size: 36 },
  { label: 'N10', text: 'L P E D', size: 28 },
  { label: 'N8', text: 'P E C F D', size: 22 },
  { label: 'N5', text: 'H N O R C V', size: 16 },
];

const CLOCK_ANGLES = [0, 30, 60, 90, 120, 150];

function eyeMode(showLeft, showRight) {
  if (showLeft && showRight) return 'both';
  if (showLeft) return 'left';
  if (showRight) return 'right';
  return 'both';
}

function TestHeading({ title, subtitle }) {
  return (
    <View style={s.headingWrap}>
      <Text style={s.heading}>{title}</Text>
      {subtitle ? <Text style={s.subheading}>{subtitle}</Text> : null}
    </View>
  );
}

function Occluder({ side }) {
  return <View style={[s.occluder, side === 'left' ? s.occluderLeft : s.occluderRight]} />;
}

function SnellenE({ rotation = 0, sizePx = 48 }) {
  const size = Math.max(54, Math.round(sizePx * 3.5));
  return (
    <View style={s.centerFill}>
      <View style={s.fixCrossBox}>
        <View style={s.fixCrossH} />
        <View style={s.fixCrossV} />
      </View>
      <Text style={[s.snellenE, { fontSize: size, transform: [{ rotate: `${rotation}deg` }] }]}>E</Text>
    </View>
  );
}

function AstigmatismClock() {
  return (
    <View style={s.centerFill}>
      <TestHeading title="Which lines look darkest?" subtitle="Astigmatism clock dial" />
      <Svg width={300} height={300} viewBox="0 0 100 100">
        <Circle cx={50} cy={50} r={48} fill="#0B0B0B" stroke="#2A2A2A" strokeWidth={1} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          return (
            <Line
              key={`tick-${i}`}
              x1={50 + 44 * Math.cos(a)}
              y1={50 + 44 * Math.sin(a)}
              x2={50 + 48 * Math.cos(a)}
              y2={50 + 48 * Math.sin(a)}
              stroke="#444"
              strokeWidth={0.8}
            />
          );
        })}
        {CLOCK_ANGLES.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <Line
              key={deg}
              x1={50 + 42 * Math.cos(rad)}
              y1={50 + 42 * Math.sin(rad)}
              x2={50 - 42 * Math.cos(rad)}
              y2={50 - 42 * Math.sin(rad)}
              stroke="#FFF"
              strokeWidth={2.2}
              strokeLinecap="round"
            />
          );
        })}
        {CLOCK_ANGLES.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x = 50 + 54 * Math.cos(rad);
          const y = 50 + 54 * Math.sin(rad);
          return (
            <SvgText
              key={`t-${deg}`}
              x={x}
              y={y + 1.5}
              fill="#999"
              fontSize={4.5}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {deg === 0 ? '180' : deg}
            </SvgText>
          );
        })}
        <Circle cx={50} cy={50} r={1.5} fill="#666" />
      </Svg>
    </View>
  );
}

function IshiharaPlate({ dots, plateIndex, totalPlates }) {
  const circles = useMemo(() => dots.map((dot, i) => (
    <Circle key={`${i}-${dot.cx}-${dot.cy}`} cx={dot.cx} cy={dot.cy} r={dot.r} fill={dot.fill} />
  )), [dots]);

  return (
    <View style={s.centerFill}>
      <TestHeading title="What number do you see?" subtitle={`Plate ${plateIndex + 1} / ${totalPlates}`} />
      <Svg width={300} height={300} viewBox="0 0 200 200">
        <Circle cx={100} cy={100} r={97} fill="#1A1A1A" />
        <Circle cx={100} cy={100} r={95} fill="#1E1E1E" stroke="#333" strokeWidth={0.6} />
        {circles}
      </Svg>
    </View>
  );
}

function NearChart() {
  return (
    <View style={s.nearWrap}>
      <TestHeading title="Near Vision" subtitle="Hold naturally and read smallest visible line" />
      {NEAR_LINES.map((line) => (
        <View key={line.label} style={s.nearRow}>
          <Text style={s.nearLabel}>{line.label}</Text>
          <Text style={[s.nearText, { fontSize: line.size }]}>{line.text}</Text>
        </View>
      ))}
    </View>
  );
}

function Waiting({ instruction }) {
  return (
    <View style={s.centerFill}>
      <Text style={s.waitText}>{instruction || 'Waiting for assistant…'}</Text>
    </View>
  );
}

function Complete() {
  return (
    <View style={s.centerFill}>
      <Text style={s.completeTitle}>Test complete</Text>
      <Text style={s.completeSub}>Please remove the headset</Text>
    </View>
  );
}

function EyePanel({
  side,
  visible,
  phase,
  instruction,
  optotype,
  plateDots,
  plateIndex,
  totalPlates,
  isComplete,
}) {
  const hidden = !visible;

  return (
    <View style={s.eyePanel}>
      {hidden && <Occluder side={side} />}
      <View style={[s.eyeInner, hidden && s.dimmed]}>
        {isComplete ? <Complete /> : null}
        {!isComplete && phase === 'waiting' ? <Waiting instruction={instruction} /> : null}
        {!isComplete && phase === 'acuity' ? <SnellenE rotation={optotype?.rotation || 0} sizePx={optotype?.sizePx || 48} /> : null}
        {!isComplete && phase === 'astigmatism' ? <AstigmatismClock /> : null}
        {!isComplete && phase === 'color' ? <IshiharaPlate dots={plateDots} plateIndex={plateIndex} totalPlates={totalPlates} /> : null}
        {!isComplete && phase === 'near' ? <NearChart /> : null}
      </View>
    </View>
  );
}

function SplitVRLayout(props) {
  const {
    showLeft = true,
    showRight = true,
    colorShowLeft = true,
    colorShowRight = true,
    nearShowLeft = true,
    nearShowRight = true,
    astigShowLeft = true,
    astigShowRight = true,
    phase = 'waiting',
    instruction = 'Waiting for assistant…',
    optotype = null,
    plateDots = [],
    plateIndex = 0,
    totalPlates = 12,
    isComplete = false,
    showFeedback = false,
    feedbackSeen = false,
  } = props;

  let leftVisible = true;
  let rightVisible = true;

  if (phase === 'acuity') {
    leftVisible = showLeft;
    rightVisible = showRight;
  } else if (phase === 'astigmatism') {
    leftVisible = astigShowLeft;
    rightVisible = astigShowRight;
  } else if (phase === 'color') {
    leftVisible = colorShowLeft;
    rightVisible = colorShowRight;
  } else if (phase === 'near') {
    leftVisible = nearShowLeft;
    rightVisible = nearShowRight;
  }

  const mode = eyeMode(leftVisible, rightVisible);
  const eyeInstruction = mode === 'left'
    ? 'Testing LEFT eye • Cover RIGHT eye'
    : mode === 'right'
      ? 'Testing RIGHT eye • Cover LEFT eye'
      : 'Testing BOTH eyes';

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <Text style={s.topTitle}>{phase === 'acuity' ? 'Far Vision' : phase === 'astigmatism' ? 'Astigmatism' : phase === 'near' ? 'Near Vision' : phase === 'color' ? 'Color Vision' : 'Waiting'}</Text>
        <Text style={s.topSub}>{eyeInstruction}</Text>
      </View>

      <View style={s.stereoRow}>
        <EyePanel
          side="left"
          visible={leftVisible}
          phase={phase}
          instruction={instruction}
          optotype={optotype}
          plateDots={plateDots}
          plateIndex={plateIndex}
          totalPlates={totalPlates}
          isComplete={isComplete}
        />
        <View style={s.separator} />
        <EyePanel
          side="right"
          visible={rightVisible}
          phase={phase}
          instruction={instruction}
          optotype={optotype}
          plateDots={plateDots}
          plateIndex={plateIndex}
          totalPlates={totalPlates}
          isComplete={isComplete}
        />
      </View>

      <View style={s.bottomGuide}>
        <View style={s.guideDot} />
        <Text style={s.bottomText}>Focus on the center. Respond to the assistant in real time.</Text>
      </View>

      {showFeedback && (
        <View pointerEvents="none" style={[s.feedbackOverlay, feedbackSeen ? s.feedbackGreen : s.feedbackRed]} />
      )}
    </View>
  );
}

export default memo(SplitVRLayout);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
    alignItems: 'center', paddingTop: 10, paddingBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.38)'
  },
  topTitle: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  topSub: { color: '#AAA', fontSize: 12, marginTop: 2 },
  stereoRow: { flex: 1, flexDirection: 'row' },
  eyePanel: { width: HALF, height, backgroundColor: '#050505' },
  eyeInner: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#050505' },
  dimmed: { opacity: 0.14 },
  separator: { width: 2, backgroundColor: '#141414' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  headingWrap: { alignItems: 'center', marginBottom: 18 },
  heading: { color: '#FFF', fontSize: 24, fontWeight: '700' },
  subheading: { color: '#8F8F8F', fontSize: 12, marginTop: 4 },
  waitText: { color: '#D0D0D0', fontSize: 24, textAlign: 'center', paddingHorizontal: 24, lineHeight: 34 },
  completeTitle: { color: '#FFF', fontSize: 34, fontWeight: '700', marginBottom: 10 },
  completeSub: { color: '#AAA', fontSize: 18 },
  snellenE: { color: '#FFF', fontWeight: '900', lineHeight: undefined, textAlign: 'center', includeFontPadding: false },
  fixCrossBox: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  fixCrossH: { position: 'absolute', width: 46, height: 2, backgroundColor: '#1D1D1D' },
  fixCrossV: { position: 'absolute', width: 2, height: 46, backgroundColor: '#1D1D1D' },
  nearWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%', paddingTop: 18 },
  nearRow: { width: '88%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginVertical: 4 },
  nearLabel: { width: 58, color: '#9A9A9A', fontSize: 18, fontWeight: '600' },
  nearText: { color: '#FFF', fontWeight: '700', letterSpacing: 1 },
  occluder: { ...StyleSheet.absoluteFillObject, zIndex: 4, backgroundColor: '#000' },
  occluderLeft: { borderRightWidth: 8, borderRightColor: '#FF4444' },
  occluderRight: { borderLeftWidth: 8, borderLeftColor: '#4499FF' },
  bottomGuide: {
    position: 'absolute', bottom: 10, left: 0, right: 0, zIndex: 5,
    alignItems: 'center', justifyContent: 'center'
  },
  guideDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF', marginBottom: 6 },
  bottomText: { color: '#8B8B8B', fontSize: 11 },
  feedbackOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 6, opacity: 0.16 },
  feedbackGreen: { backgroundColor: '#00FF88' },
  feedbackRed: { backgroundColor: '#FF4444' },
});
