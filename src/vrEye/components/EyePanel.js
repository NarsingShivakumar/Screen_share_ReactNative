/**
 * EyePanel.js  v5.0
 *
 * ── Source of truth: patient.component.html/.scss ────────────────────────────
 *
 * ALL styles are exact pixel/color ports from Angular SCSS.
 * Calibration-based sizing is handled inside each test component.
 *
 * Layout:
 *   .vr-screen { flex-direction: row }
 *   .vr-divider { width: 2px; background: #1a1a1a }
 *   .split-eye { flex: 1; align-items: center; justify-content: center }
 *
 * Eye label:
 *   .eye-label { position: absolute; top: 8px; font-size: 11px;
 *                color: rgba(180,180,180,.5); font-weight: 700; letter-spacing: 2px }
 *   .left-eye .eye-label  { left: 10px }
 *   .right-eye .eye-label { right: 10px }
 *
 * Occluder:
 *   .occluded { background: #000 !important }
 *   .occluder  { position: absolute; inset: 0; background: #000; z-index: 5 }
 *
 * Feedback flash:
 *   .feedback-flash.seen    { background: rgba(76,175,80,.3) }
 *   .feedback-flash.notseen { background: rgba(244,67,54,.3) }
 *   transition: opacity .1s; duration 500ms
 *
 * Audio dot:
 *   .audio-dot.connecting { background: #f9a825; animation: pulse 1s }
 *   .audio-dot.active     { background: #4caf50; animation: pulse 1.4s }
 *   .audio-dot.muted      { background: #555 }
 *   .audio-dot.error      { background: #e53935 }
 */

import React, { memo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated,
  TouchableOpacity,
  Image,
} from 'react-native';

import OptotypeTest from './tests/OptotypeTest';
import { NearVisionLines } from './tests/OptotypeTest';
import AstigmatismTest from './tests/AstigmatismTest';
import IshiharaTest from './tests/IshiharaTest';
import NearVisionTest from './tests/NearVisionTest';
import { useNavigation } from '@react-navigation/native';
import CompleteScreen from './tests/CompleteScreen';
import WaitingScreen from './tests/WaitingScreen';
import LensCheckTarget from './tests/LensCheckTarget';

// ─────────────────────────────────────────────────────────────────────────────
function EyePanel({
  panelWidth,
  panelHeight,
  side,              // 'left' | 'right'
  active,
  phase,
  instruction,
  patientName,
  optotype,
  plateDots,
  plateIndex,
  totalPlates,
  showFeedback,
  feedbackSeen,
  parallax,
  onCloseSession,
  nearOptotype,
  isLensCheck,
  lensCheckEye,
  contentTranslateX = 0,
}) {
  // ── Feedback flash animation (Angular transition: opacity .1s) ────────────
  const feedbackOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showFeedback) {
      Animated.sequence([
        Animated.timing(feedbackOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(feedbackOpacity, { toValue: 0, duration: 100, useNativeDriver: true, delay: 300 }),
      ]).start();
    } else {
      feedbackOpacity.setValue(0);
    }
  }, [showFeedback, feedbackSeen]);

  const PW = panelWidth ?? 200;
  const PH = panelHeight ?? 400;

  // ── Occluded eye ──────────────────────────────────────────────────────────
  if (!active) {
    return (
      <View style={[styles.panel, { width: PW, height: PH }]}>
        <Text style={[
          styles.eyeLabel,
          side === 'left' ? styles.eyeLabelLeft : styles.eyeLabelRight,
        ]}>
          {side === 'left' ? 'L' : 'R'}
        </Text>
        {/* .occluder */}
        <View style={styles.occluder} />
      </View>
    );
  }

  // ── Active eye — phase routing ────────────────────────────────────────────
  const renderContent = () => {
    switch (phase) {
      case 'acuity':
        return (
          <OptotypeTest
            optotype={optotype}
            panelWidth={PW}
            panelHeight={PH}
            parallax={parallax}
          />
        );

      case 'astigmatism':
        return (
          <AstigmatismTest
            panelWidth={PW}
            panelHeight={PH}
            parallax={parallax}
          />
        );

      case 'color':
        return (
          <IshiharaTest
            dots={plateDots}
            plateIndex={plateIndex}
            totalPlates={totalPlates}
            panelWidth={PW}
            panelHeight={PH}
            parallax={parallax}
          />
        );

      case 'near':
        return (
          <NearVisionTest
            nearOptotype={nearOptotype}
            panelWidth={PW}
            panelHeight={PH}
            parallax={parallax}
            fade={false}
          />
        );

      case 'complete':
        return <CompleteScreen onClose={onCloseSession} />;
      case 'waiting':
      default:
        if (isLensCheck) {
          return (
            <LensCheckTarget
              panelWidth={PW}
              panelHeight={PH}
              side={side}
              active={active}
            />
          );
        }
        return <WaitingScreen message={instruction} patientName={patientName} />;
    }
  };

  return (
    <View style={[styles.panel, { width: PW, height: PH }]}>

      {/* Test content */}
      <View
        style={[
          styles.contentWrapper,
          { transform: [{ translateX: contentTranslateX }] },
        ]}
      >
        {renderContent()}
      </View>
      {/* .eye-label — Angular: absolute top:8px, L:left:10px / R:right:10px */}
      <Text style={[
        styles.eyeLabel,
        side === 'left' ? styles.eyeLabelLeft : styles.eyeLabelRight,
      ]}>
        {side === 'left' ? 'L' : 'R'}
      </Text>

      {/* .feedback-flash — green seen / red not-seen */}
      {/* <Animated.View
        pointerEvents="none"
        style={[
          styles.feedbackFlash,
          {
            backgroundColor: feedbackSeen
              ? 'rgba(76,175,80,0.3)'    // Angular: &.seen { background: rgba(76,175,80,.3) }
              : 'rgba(244,67,54,0.3)',   // Angular: &.notseen { background: rgba(244,67,54,.3) }
            opacity: feedbackOpacity,
          },
        ]}
      /> */}
    </View>
  );
}

// ── Waiting screen styles ─────────────────────────────────────────────────────
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

// ── Complete screen styles ────────────────────────────────────────────────────
const c = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: 12,             // Angular: gap: 12px
  },
  // .complete-icon: width:60px height:60px border-radius:50% background:#4caf50
  icon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4caf50',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(76,175,80,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 12,
  },
  // Angular: font-size: 28px; color: #fff; font-weight: 700
  iconText: { fontSize: 28, color: '#ffffff', fontWeight: '700' },
  // .complete-text: color:#fff font-size:18px font-weight:600
  text: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  // .complete-sub: color:#ccc font-size:13px
  sub: {
    color: '#cccccc',
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

// ── Main EyePanel styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // .split-eye
  panel: {
    backgroundColor: '#000000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  // .eye-label
  eyeLabel: {
    position: 'absolute',
    top: 8,                           // Angular: top: 8px
    fontSize: 11,                          // Angular: font-size: 11px
    color: 'rgba(180,180,180,0.5)',     // Angular: color: rgba(180,180,180,.5)
    fontWeight: '700',
    letterSpacing: 2,                           // Angular: letter-spacing: 2px
    zIndex: 10,
  },
  eyeLabelLeft: { left: 10 },                 // Angular: .left-eye .eye-label { left: 10px }
  eyeLabelRight: { right: 10 },                 // Angular: .right-eye .eye-label { right: 10px }

  // .occluder
  occluder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 5,
  },
    contentWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // .feedback-flash
  feedbackFlash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
});

export default memo(EyePanel);