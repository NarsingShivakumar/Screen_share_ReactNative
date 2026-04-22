/**
 * SplitVRLayout.js  v5.0
 *
 * ── Source of truth: patient.component.html/.scss ────────────────────────────
 *
 * Layout structure (Angular):
 *   .vr-root  → fixed inset:0, background:#000, overflow:hidden
 *   .vr-screen → position:absolute inset:0, flex-direction:row, align-items:stretch
 *   .vr-divider → width:2px background:#1a1a1a flex-shrink:0 z-index:10
 *   .split-eye → flex:1 (each eye panel)
 *
 * Portrait mode compensation (Angular SCSS):
 *   .vr-root in portrait:
 *     width: 100dvh; height: 100dvw
 *     transform: rotate(-90deg) translate(-100%, 0)
 *     transform-origin: top left
 *   → In RN: use react-native-orientation-locker to force landscape.
 *     If portrait is forced, Dimensions still returns portrait values.
 *     We handle this by swapping width/height and applying a rotation transform.
 *
 * Parallax layers (.scene-layer):
 *   .scene-bg  → z-index:1; transition: transform 16ms linear; filter: blur(5px)
 *   .scene-mid → z-index:2; transition: transform 16ms linear; filter: blur(2px)
 *   .scene-fg  → z-index:3; flex-direction:column; align-items:center; justify-content:center
 *   Parallax factors from calibration.service.ts: bg:4.0, mid:2.0, fg:0.5
 *
 * Audio dot (.audio-badge):
 *   position:absolute top:12px left:50% z-index:30
 *   .audio-dot: width:8px height:8px border-radius:50%
 *     .connecting: background:#f9a825; animation: pulse 1s
 *     .active:     background:#4caf50; animation: pulse 1.4s
 *     .muted:      background:#555
 *     .error:      background:#e53935
 */

import React, { memo, useEffect, useRef } from 'react';
import {
  View, StyleSheet, Dimensions, Animated,
} from 'react-native';

import EyePanel from './EyePanel';
import calibrationService from '../services/calibrationService';

// ── Audio dot ─────────────────────────────────────────────────────────────────
function AudioDot({ rtcState }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (rtcState.isInitialising || (rtcState.isConnected && !rtcState.isMuted)) {
      const duration = rtcState.isInitialising ? 1000 : 1400; // Angular: 1s / 1.4s
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.5, duration: duration / 2, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: duration / 2, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [rtcState.isInitialising, rtcState.isConnected, rtcState.isMuted]);

  // Angular: only one dot visible at a time
  let dotColor = '#555';   // muted default
  if (rtcState.isInitialising) dotColor = '#f9a825'; // connecting
  else if (rtcState.isConnected && !rtcState.isMuted) dotColor = '#4caf50'; // active
  else if (rtcState.hasError) dotColor = '#e53935'; // error

  return (
    <View style={aud.badge} pointerEvents="none">
      <Animated.View
        style={[
          aud.dot,
          {
            backgroundColor: dotColor,
            opacity: (rtcState.isInitialising || (rtcState.isConnected && !rtcState.isMuted))
              ? pulseAnim
              : 1,
          },
        ]}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function SplitVRLayout({
  phase,
  instruction,
  patientName,
  optotype,
  isComplete,
  showLeft, showRight,
  colorShowLeft, colorShowRight,
  nearShowLeft, nearShowRight,
  astigShowLeft, astigShowRight,
  plateDots, plateIndex, totalPlates,
  showFeedback, feedbackSeen,
  parallax,       // { bg:{x,y}, mid:{x,y}, fg:{x,y} } from gyroscope
  rtcState,       // { isConnected, isMuted, isInitialising, hasError }
  onCloseSession,
  nearOptotype,
  isLensCheck,
  lensCheckEye,
}) {
  const dim = Dimensions.get('window');
  // In landscape VR mode:
  const screenW = Math.max(dim.width, dim.height);
  const screenH = Math.min(dim.width, dim.height);
  const panelW = (screenW - 2) / 2;   // 2px divider
  const panelH = screenH;

  // ── Eye visibility per phase ───────────────────────────────────────────────
  const leftActive = (() => {
    if (isComplete) return true;
    if (isLensCheck) return showLeft;

    switch (phase) {
      case 'acuity': return showLeft;
      case 'color': return colorShowLeft;
      case 'near': return nearShowLeft;
      case 'astigmatism': return astigShowLeft;
      default: return true;
    }
  })();

  const rightActive = (() => {
    if (isComplete) return true;
    if (isLensCheck) return showRight;

    switch (phase) {
      case 'acuity': return showRight;
      case 'color': return colorShowRight;
      case 'near': return nearShowRight;
      case 'astigmatism': return astigShowRight;
      default: return true;
    }
  })();
  const isBothEyesActive = leftActive && rightActive && !isComplete;

  // Small convergence correction so both-eye mode appears as one fused image
  // Increase/decrease this value slightly depending on headset optics.
  const convergenceShift = isBothEyesActive
    ? Math.min(panelW * 0.03, 12)
    : 0;

  const leftContentTranslateX = isBothEyesActive ? convergenceShift : 0;
  const rightContentTranslateX = isBothEyesActive ? -convergenceShift : 0;

  // ── Parallax transform helper ─────────────────────────────────────────────
  // Angular: [style.transform]="getLayerTransform('bg')"
  // calibrationService.toTransformString({ x, y }) → "translate(x px, y px)"
  const layerStyle = (layer) => {
    if (!parallax) return {};
    const { x, y } = parallax[layer] ?? { x: 0, y: 0 };
    return { transform: [{ translateX: x }, { translateY: y }] };
  };

  return (
    // .vr-root → background:#000 overflow:hidden
    <View style={styles.vrRoot}>

      {/* .vr-screen → flex-direction:row align-items:stretch */}
      <View style={styles.vrScreen}>

        {/* Left eye panel (.split-eye.left-eye) */}
        <EyePanel
          panelWidth={panelW}
          panelHeight={panelH}
          side="left"
          active={leftActive}
          phase={isComplete ? 'complete' : phase}
          instruction={instruction}
          patientName={patientName}
          optotype={optotype}
          plateDots={plateDots}
          plateIndex={plateIndex}
          totalPlates={totalPlates}
          showFeedback={showFeedback}
          feedbackSeen={feedbackSeen}
          parallax={parallax}
          onCloseSession={onCloseSession}
          nearOptotype={nearOptotype}
          isLensCheck={isLensCheck}
          lensCheckEye={lensCheckEye}
          contentTranslateX={leftContentTranslateX}
        />

        {/* .vr-divider → width:2px background:#1a1a1a */}
        <View style={styles.vrDivider} />

        {/* Right eye panel (.split-eye.right-eye) */}
        <EyePanel
          panelWidth={panelW}
          panelHeight={panelH}
          side="right"
          active={rightActive}
          phase={isComplete ? 'complete' : phase}
          instruction={instruction}
          patientName={patientName}
          optotype={optotype}
          plateDots={plateDots}
          plateIndex={plateIndex}
          totalPlates={totalPlates}
          showFeedback={showFeedback}
          feedbackSeen={feedbackSeen}
          parallax={parallax}
          onCloseSession={onCloseSession}
          nearOptotype={nearOptotype}
          isLensCheck={isLensCheck}
          lensCheckEye={lensCheckEye}
        />
      </View>

      {/* .audio-badge — position:absolute top:12px left:50% */}
      {rtcState && <AudioDot rtcState={rtcState} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // .vr-root (landscape)
  vrRoot: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },

  // .vr-screen
  vrScreen: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  // .vr-divider
  vrDivider: {
    width: 2,              // Angular: width: 2px
    backgroundColor: '#1a1a1a',     // Angular: background: #1a1a1a
    flexShrink: 0,
    zIndex: 10,
  },
});

// Audio dot styles
const aud = StyleSheet.create({
  // .audio-badge: position:absolute top:12px left:50% z-index:30
  badge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    left: '50%',              // centred over divider
    marginLeft: -4,                // half dot width (8px)
    zIndex: 30,
  },
  // .audio-dot: width:8px height:8px border-radius:50%
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default memo(SplitVRLayout);