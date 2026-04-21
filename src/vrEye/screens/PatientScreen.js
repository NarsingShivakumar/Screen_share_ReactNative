/**
 * PatientScreen.js  v6.1
 *
 * Full-screen VR changes:
 * - Enter immersive full-screen on eye test start
 * - Hide Android bottom navigation/back buttons
 * - Hide status bar
 * - Keep content out of notch/cutout area using SafeAreaView
 * - Set screen brightness to 70% during test
 * - Restore UI + brightness when leaving test
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, BackHandler,
  KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import socketService from '../services/socketService';
import webRTCService from '../services/webRTCService';
import calibrationService from '../services/calibrationService';
import { generatePlateDots, getPlate, TOTAL_PLATES } from '../utils/ishiharaPanel';
import SplitVRLayout from '../components/SplitVRLayout';
import { useTTS } from '../hooks/useTTS';

let Orientation = null;
let KeepAwake = null;
let SystemNavigationBar = null;
let ScreenBrightness = null;

try { Orientation = require('react-native-orientation-locker').default; } catch { }
try { KeepAwake = require('react-native-keep-awake').default; } catch { }
try { SystemNavigationBar = require('react-native-system-navigation-bar').default; } catch { }
try { ScreenBrightness = require('react-native-screen-brightness'); } catch { }

// ─────────────────────────────────────────────────────────────────────────────
export default function PatientScreen({ route, navigation, roomCode: propRoomCode }) {
  const resolvedCode = route?.params?.roomCode ?? propRoomCode ?? '';
  const autoStart = route?.params?.autoStart ?? false;
  const autoStartedRef = useRef(false);

  // ── Entry state ───────────────────────────────────────────────────────────
  const [roomCode, setRoomCode] = useState(resolvedCode);
  const [manualInput, setManualInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [codeConfirmed, setCodeConfirmed] = useState(!!resolvedCode);
  const [inVR, setInVR] = useState(false);
  const [isLensCheck, setIsLensCheck] = useState(false);
  const [lensCheckEye, setLensCheckEye] = useState('both');

  // ── Vision state ──────────────────────────────────────────────────────────
  const [phase, setPhase] = useState('waiting');
  const [instruction, setInstruction] = useState('Waiting for the assistant to start the test\u2026');
  const [patientName, setPatientName] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [optotype, setOptotype] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSeen, setFeedbackSeen] = useState(false);

  // ── Eye flags ─────────────────────────────────────────────────────────────
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [colorShowLeft, setColorShowLeft] = useState(true);
  const [colorShowRight, setColorShowRight] = useState(true);
  const [nearShowLeft, setNearShowLeft] = useState(true);
  const [nearShowRight, setNearShowRight] = useState(true);
  const [astigShowLeft, setAstigShowLeft] = useState(true);
  const [astigShowRight, setAstigShowRight] = useState(true);
  const [nearOptotype, setNearOptotype] = useState(null);

  // ── Ishihara ──────────────────────────────────────────────────────────────
  const [plateIndex, setPlateIndex] = useState(0);
  const [plateDots, setPlateDots] = useState([]);

  // ── WebRTC ────────────────────────────────────────────────────────────────
  const [rtcState, setRtcState] = useState({
    isMuted: false, isConnected: false,
    isInitialising: false, hasError: false, errorMessage: '',
  });

  // ── Parallax ──────────────────────────────────────────────────────────────
  const [parallax, setParallax] = useState(null);

  const feedbackTimer = useRef(null);
  const socketUnsubs = useRef([]);
  const previousBrightness = useRef(null);

  // ── TTS ───────────────────────────────────────────────────────────────────
  const { speak, speakPhase, speakEye, resetEyeState } = useTTS();

  // ── Helpers: immersive mode / brightness ─────────────────────────────────
  const enableTestFullscreen = useCallback(async () => {
    try { Orientation?.lockToLandscape(); } catch { }
    try { KeepAwake?.activate(); } catch { }

    if (Platform.OS === 'android') {
      try {
        await SystemNavigationBar?.stickyImmersive?.();
      } catch {
        try { await SystemNavigationBar?.immersive?.(); } catch { }
      }

      try { StatusBar.setHidden(true, 'fade'); } catch { }
    } else {
      try { StatusBar.setHidden(true, 'fade'); } catch { }
    }

    try {
      if (ScreenBrightness?.getBrightness && ScreenBrightness?.setBrightness) {
        const current = await ScreenBrightness.getBrightness();
        previousBrightness.current = current;
        await ScreenBrightness.setBrightness(0.7);
      }
    } catch { }
  }, []);

  const disableTestFullscreen = useCallback(async () => {
    try { Orientation?.unlockAllOrientations(); } catch { }
    try { KeepAwake?.deactivate(); } catch { }

    if (Platform.OS === 'android') {
      try { await SystemNavigationBar?.show?.(); } catch { }
      try { StatusBar.setHidden(false, 'fade'); } catch { }
    } else {
      try { StatusBar.setHidden(false, 'fade'); } catch { }
    }

    try {
      if (
        ScreenBrightness?.setBrightness &&
        previousBrightness.current != null
      ) {
        await ScreenBrightness.setBrightness(previousBrightness.current);
      }
      previousBrightness.current = null;
    } catch { }
  }, []);

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    calibrationService.autoDetectPpi();
    loadPlate(0);

    return () => {
      socketUnsubs.current.forEach(fn => fn?.());
      webRTCService.disconnect();
      socketService.disconnect();
      clearTimeout(feedbackTimer.current);

      disableTestFullscreen();
    };
  }, [disableTestFullscreen]);

  // ── Apply / restore full-screen whenever VR starts/stops ─────────────────
  useEffect(() => {
    if (inVR) {
      enableTestFullscreen();
    } else {
      disableTestFullscreen();
    }
  }, [inVR, enableTestFullscreen, disableTestFullscreen]);

  // ── Voice: room-code entry renders ────────────────────────────────────────
  useEffect(() => {
    if (!codeConfirmed) {
      const t = setTimeout(() => {
        speak("Enter the room code shown on the assistant's screen.");
      }, 600);
      return () => clearTimeout(t);
    }
  }, [codeConfirmed, speak]);

  // ── Gyroscope → parallax ──────────────────────────────────────────────────
  useEffect(() => {
    let sub;
    try {
      const { gyroscope } = require('react-native-sensors');
      sub = gyroscope.subscribe(({ x: beta, y: gamma }) => {
        const g = Math.max(-25, Math.min(25, gamma * (180 / Math.PI)));
        const b = Math.max(-25, Math.min(25, beta * (180 / Math.PI)));
        setParallax(calibrationService.computeParallax(g, b));
      });
    } catch { }
    return () => sub?.unsubscribe?.();
  }, []);

  // ── WebRTC state ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = webRTCService.onStateChange(setRtcState);
    return () => unsub();
  }, []);

  // ── Plate loader ──────────────────────────────────────────────────────────
  const loadPlate = useCallback((index) => {
    const plate = getPlate(index);
    setPlateDots(generatePlateDots(plate));
    setPlateIndex(index);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // returnToEntry(msg?)
  // ─────────────────────────────────────────────────────────────────────────
  const returnToEntry = useCallback((msg = '') => {
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = null;

    socketUnsubs.current.forEach(fn => fn?.());
    socketUnsubs.current = [];

    webRTCService.disconnect();
    socketService.disconnect();

    disableTestFullscreen();

    setInVR(false);
    setIsComplete(false);
    setPhase('waiting');
    setInstruction('Waiting for the assistant to start the test\u2026');
    setPatientName('');
    setOptotype(null);
    setNearOptotype(null);
    setShowFeedback(false);
    setFeedbackSeen(false);
    setShowLeft(true); setShowRight(true);
    setColorShowLeft(true); setColorShowRight(true);
    setNearShowLeft(true); setNearShowRight(true);
    setAstigShowLeft(true); setAstigShowRight(true);
    setParallax(null);
    setRtcState({
      isMuted: false, isConnected: false,
      isInitialising: false, hasError: false, errorMessage: '',
    });
    loadPlate(0);

    setManualInput(roomCode);
    setInputError('');
    setJoinError(msg);
    setCodeConfirmed(false);
    setIsLensCheck(false);
    setLensCheckEye('both');
  }, [disableTestFullscreen, loadPlate, roomCode]);

  // ── resetSessionAndGoToJoin ───────────────────────────────────────────────
  const resetSessionAndGoToJoin = useCallback(() => {
    returnToEntry('');
    setManualInput('');
  }, [returnToEntry]);

  const handleCloseSession = useCallback(() => resetSessionAndGoToJoin(), [resetSessionAndGoToJoin]);

  // ── Manual room code entry ────────────────────────────────────────────────
  const confirmManualCode = useCallback(() => {
    const t = manualInput.trim().toUpperCase();
    if (!t) { setInputError('Please enter a room code.'); return; }
    if (t.length < 4) { setInputError('Room code must be at least 4 characters.'); return; }
    setInputError('');
    setJoinError('');
    setRoomCode(t);
    setCodeConfirmed(true);
    speak('Tap Begin Test, then put on your headset.');
  }, [manualInput, speak]);

  useEffect(() => {
    if (
      autoStart &&
      roomCode &&
      codeConfirmed &&
      !inVR &&
      !autoStartedRef.current
    ) {
      autoStartedRef.current = true;
      const timer = setTimeout(() => {
        enterVR();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [autoStart, roomCode, codeConfirmed, inVR, enterVR]);
  // ── Enter VR ──────────────────────────────────────────────────────────────
  const enterVR = useCallback(async () => {
    speak('Connecting to session. Please wait.');
    setInVR(true);
    setJoinError('');
    socketService.connect('patient');
    attachSocketListeners(roomCode);
    socketService.onConnected(() => {
      socketService.emit('vr_join_session', { roomCode });
    });
  }, [roomCode, speak]);

  // ── Android back button ───────────────────────────────────────────────────
  useEffect(() => {
    if (!inVR) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [inVR]);

  // ── Socket listeners ──────────────────────────────────────────────────────
  function attachSocketListeners(code) {
    const U = socketUnsubs.current;

    U.push(socketService.on('session_joined', async (data) => {
      const name = data.patientName ?? '';
      setPatientName(name);
      setPhase(data.phase ?? 'waiting');
      speak(name ? `Welcome, ${name}. Be ready for the test.` : 'Welcome. Be ready for the test.');
      await webRTCService.initAudio('patient', code);
    }));

    U.push(socketService.on('set_calibration', (data) => {
      calibrationService.setProfile({
        ipdMm: data.ipdMm ?? 63,
        lensMagnification: data.lensMagnification ?? 1.0,
        physicalDistanceMm: data.physicalDistanceMm ?? 350,
      });
      if (data.autoPpi) calibrationService.autoDetectPpi();
    }));

    U.push(socketService.on('mute_patient', (data) => {
      webRTCService.forceLocalMute(data.muted);
    }));

    U.push(socketService.on('webrtc_ping', () => {
      socketService.emit('vr_webrtc_patient_ready', { roomCode: code });
    }));

    U.push(socketService.on('session_error', (data) => {
      const msg = data?.message ?? 'Could not join session. Please check the room code.';
      speak(msg);
      returnToEntry(msg);
    }));

    U.push(socketService.on('show_instruction', (data) => {
      setIsLensCheck(false);
      setLensCheckEye('both');
      setInstruction(data.message);
      setPhase('waiting');
      setOptotype(null);
      speak(data.message);
    }));
    U.push(socketService.on('lens_check', (data) => {
      const eye = data?.eye ?? 'both';

      const showLeftEye = eye === 'left' || eye === 'both';
      const showRightEye = eye === 'right' || eye === 'both';

      setPhase('waiting');
      setIsComplete(false);
      setOptotype(null);
      setNearOptotype(null);

      setIsLensCheck(true);
      setLensCheckEye(eye);

      setShowLeft(showLeftEye);
      setShowRight(showRightEye);

      setInstruction('Adjust the headset until the circles are centered and clear.');
    }));

    U.push(socketService.on('session_closed', (data) => {
      setIsComplete(true);
      setPhase('complete');
      const msg = data?.message ?? 'The screening session has been completed. Thank you!';
      setInstruction(msg);
      speak(msg);
    }));

    U.push(socketService.on('session_ended', (data) => {
      const msg = data?.message ?? 'This session has already been completed. Please ask the assistant for a new room code.';
      speak(msg);
      returnToEntry(msg);
    }));

    U.push(socketService.on('phase_changed', (data) => {
      const p = data.phase;
      setIsLensCheck(false);
      setLensCheckEye('both');
      setPhase(p);
      setOptotype(null);
      resetEyeState();
      speakPhase(p);
      if (p === 'astigmatism') { setAstigShowLeft(true); setAstigShowRight(true); }
      if (p === 'color') { loadPlate(0); setColorShowLeft(true); setColorShowRight(true); }
      if (p === 'near') { setNearShowLeft(true); setNearShowRight(true); setNearOptotype(null); }
    }));

    U.push(socketService.on('show_color_plate', (data) => {
      loadPlate(data?.plateIndex ?? 0);
      speak('What number do you see in this plate?');
    }));

    U.push(socketService.on('show_color_eye', (data) => {
      const eye = data?.eye ?? 'both';
      const L = eye === 'left' || eye === 'both';
      const R = eye === 'right' || eye === 'both';
      setColorShowLeft(L); setColorShowRight(R);
      spe / akEye(L, R);
    }));

    U.push(socketService.on('show_near_eye', (data) => {
      const eye = data?.eye ?? 'both';
      const L = eye === 'left' || eye === 'both';
      const R = eye === 'right' || eye === 'both';
      setNearShowLeft(L); setNearShowRight(R);
      // speakEye(L, R);
    }));

    U.push(socketService.on('show_optotype', (data) => {
      const normalized = {
        roomCode: data?.roomCode ?? code,
        phase: data?.phase ?? 'acuity',
        letter: data?.letter ?? 'E',
        rotation: typeof data?.rotation === 'number' ? data.rotation : 0,
        sizeLevel: typeof data?.sizeLevel === 'number' ? data.sizeLevel : 0,
        eye: data?.eye ?? 'both',
        acuityLabel: data?.acuityLabel ?? '',
      };

      if (normalized.phase === 'color') {
        const eye = normalized.eye ?? 'both';
        const L = eye === 'left' || eye === 'both';
        const R = eye === 'right' || eye === 'both';
        setColorShowLeft(L); setColorShowRight(R);
        if (normalized.sizeLevel != null) loadPlate(normalized.sizeLevel);
        // speakEye(L, R);
        return;
      }

      if (normalized.phase === 'near') {
        const eye = normalized.eye ?? 'both';
        const L = eye === 'left' || eye === 'both';
        const R = eye === 'right' || eye === 'both';

        setTimeout(() => {
          setNearOptotype({
            letter: normalized.letter,
            sizeLevel: normalized.sizeLevel,
            acuityLabel: normalized.acuityLabel,
          });
          setNearShowLeft(L);
          setNearShowRight(R);
        }, 120);

        // speakEye(L, R);
        return;
      }

      if (normalized.phase === 'astigmatism') {
        const eye = normalized.eye ?? 'both';
        const L = eye === 'left' || eye === 'both';
        const R = eye === 'right' || eye === 'both';
        setAstigShowLeft(L); setAstigShowRight(R);
        // speakEye(L, R);
        return;
      }

      setShowFeedback(false);
      setTimeout(() => {
        setOptotype(normalized);
        const eye = normalized.eye ?? 'both';
        const L = eye === 'left' || eye === 'both';
        const R = eye === 'right' || eye === 'both';
        setShowLeft(L); setShowRight(R);
        // speakEye(L, R);
      }, 120);
    }));

    U.push(socketService.on('response_recorded', (data) => {
      setFeedbackSeen(data.seen);
      setShowFeedback(true);
      clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setShowFeedback(false), 500);
    }));

    U.push(socketService.on('test_complete', () => {
      setIsComplete(true);
      setPhase('complete');
      speak('Test complete. Please remove your headset.');
    }));

    U.push(socketService.on('peer_disconnected', () => {
      const msg = 'The assistant has disconnected. Please re-enter the room code to rejoin.';
      speak(msg);
      returnToEntry(msg);
    }));
  }

  // ─── RENDER A: Room code entry ─────────────────────────────────────────────
  if (!codeConfirmed) {
    return (
      <SafeAreaProvider>
        <KeyboardAvoidingView
          style={s.entryScreen}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <StatusBar barStyle="light-content" backgroundColor="#0d0d0d" hidden={false} />
          <View style={s.entryCard}>
            <View style={s.logoRow}>
              <View style={s.logoIcon}><Text style={s.logoEmoji}>👁</Text></View>
              <Text style={s.entryTitle}>VR Vision Test</Text>
            </View>

            <Text style={s.entrySubtitle}>
              Enter the room code from the assistant's screen
            </Text>

            <View style={[s.inputWrapper, (inputError || joinError) ? s.inputWrapperError : null]}>
              <TextInput
                style={s.codeInput}
                value={manualInput}
                onChangeText={(t) => {
                  setManualInput(t.toUpperCase());
                  setInputError('');
                  setJoinError('');
                }}
                placeholder="e.g. 891BDE"
                placeholderTextColor="#444"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                returnKeyType="done"
                onSubmitEditing={confirmManualCode}
                selectionColor="#5b5bd6"
              />
            </View>

            {inputError ? <Text style={s.inputError}>{inputError}</Text> : null}

            {joinError ? (
              <View style={s.joinErrorBanner}>
                <Text style={s.joinErrorIcon}>⚠️</Text>
                <Text style={s.joinErrorText}>{joinError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.primaryBtn, !manualInput.trim() && s.primaryBtnDisabled]}
              onPress={confirmManualCode}
              disabled={!manualInput.trim()}
              activeOpacity={0.8}
            >
              <Text style={s.primaryBtnText}>Join Session</Text>
            </TouchableOpacity>

            <Text style={s.entryHint}>Ask the assistant to share the room code.</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    );
  }

  // ─── RENDER B: Pre-VR start overlay ───────────────────────────────────────
  if (!inVR) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={s.overlay} edges={['top', 'bottom', 'left', 'right']}>
          <StatusBar hidden={false} />
          <View style={s.startCard}>
            <View style={s.startLogo}><Text style={{ fontSize: 34 }}>👁</Text></View>

            <View style={s.startHeader}>
              <Text style={s.startEyebrow}>Clinical Vision Test</Text>
              <Text style={s.startTitle}>Vision Screening</Text>
            </View>

            {roomCode ? (
              <View style={s.startRoomBadge}>
                <Text style={s.startRoomLabel}>ROOM</Text>
                <Text style={s.startRoomCode}>{roomCode}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={s.changeBtn}
              onPress={() => { setCodeConfirmed(false); setManualInput(roomCode); }}
            >
              <Text style={s.changeText}>Change room code</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.startBtn} onPress={enterVR} activeOpacity={0.85}>
              <Text style={s.startBtnText}>▶  Begin Test</Text>
            </TouchableOpacity>

            <Text style={s.startHint}>Put on your headset before tapping</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // ─── RENDER C: Active VR session ──────────────────────────────────────────
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.vrRoot} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar hidden translucent backgroundColor="transparent" />

        <SplitVRLayout
          phase={phase}
          instruction={instruction}
          patientName={patientName}
          optotype={optotype}
          isComplete={isComplete}
          showLeft={showLeft}
          showRight={showRight}
          colorShowLeft={colorShowLeft}
          colorShowRight={colorShowRight}
          nearShowLeft={nearShowLeft}
          nearShowRight={nearShowRight}
          astigShowLeft={astigShowLeft}
          astigShowRight={astigShowRight}
          plateDots={plateDots}
          plateIndex={plateIndex}
          totalPlates={TOTAL_PLATES}
          showFeedback={showFeedback}
          feedbackSeen={feedbackSeen}
          parallax={parallax}
          rtcState={rtcState}
          onCloseSession={handleCloseSession}
          nearOptotype={nearOptotype}
          isLensCheck={isLensCheck}
          lensCheckEye={lensCheckEye}
        />

        <TouchableOpacity
          style={s.muteBtn}
          onPress={() => webRTCService.toggleMute()}
          activeOpacity={0.8}
        >
          <Text style={s.muteText}>{rtcState.isMuted ? '🔇' : '🎙'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  entryScreen: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  entryCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
  },

  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },

  logoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#5b5bd6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoEmoji: { fontSize: 22 },
  entryTitle: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  entrySubtitle: {
    color: '#777',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
    lineHeight: 20,
  },

  inputWrapper: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#333',
    borderRadius: 12,
    backgroundColor: '#111',
    marginBottom: 8,
  },

  inputWrapperError: { borderColor: '#CC3333' },

  codeInput: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },

  inputError: {
    color: '#FF4444',
    fontSize: 12,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },

  joinErrorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
    backgroundColor: 'rgba(204,51,51,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(204,51,51,0.35)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },

  joinErrorIcon: { fontSize: 14, lineHeight: 18 },
  joinErrorText: { flex: 1, color: '#FF6666', fontSize: 12, lineHeight: 18 },

  primaryBtn: {
    width: '100%',
    backgroundColor: '#5b5bd6',
    paddingVertical: 15,
    borderRadius: 100,
    alignItems: 'center',
    marginTop: 8,
  },

  primaryBtnDisabled: { opacity: 0.35 },
  primaryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600', letterSpacing: 0.04 * 14 },
  entryHint: { color: '#3a3a4a', fontSize: 10.5, marginTop: 14, textAlign: 'center' },

  overlay: {
    flex: 1,
    backgroundColor: '#080820',
    alignItems: 'center',
    justifyContent: 'center',
  },

  startCard: {
    alignItems: 'center',
    gap: 22,
    paddingTop: 44,
    paddingBottom: 36,
    paddingHorizontal: 40,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(124,124,240,0.22)',
    borderRadius: 20,
    width: Math.min(360, Dimensions.get('window').width * 0.88),
    shadowColor: '#5b5bd6',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.07,
    shadowRadius: 32,
  },

  startLogo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(91,91,214,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124,124,240,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  startHeader: { alignItems: 'center', gap: 6 },
  startEyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 1.8, color: '#5b5bd6', textTransform: 'uppercase' },
  startTitle: { fontSize: 26, fontWeight: '300', color: '#e8e8f0', letterSpacing: 0.5 },

  startRoomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(91,91,214,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(91,91,214,0.2)',
    borderRadius: 100,
  },

  startRoomLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: '#5b5bd6', textTransform: 'uppercase' },
  startRoomCode: { fontSize: 13, fontFamily: 'Courier New', fontWeight: '700', color: '#c0c0e0', letterSpacing: 1.3 },
  changeBtn: { paddingVertical: 4 },
  changeText: { color: '#5b5bd6', fontSize: 12, textDecorationLine: 'underline' },

  startBtn: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: '#5b5bd6',
    borderRadius: 100,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#5b5bd6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },

  startBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: 0.6 },
  startHint: { fontSize: 10.5, color: '#3a3a4a' },

  vrRoot: {
    flex: 1,
    backgroundColor: '#000',
  },

  muteBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },

  muteText: { fontSize: 16 },
});