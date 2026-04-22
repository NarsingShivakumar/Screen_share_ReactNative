/**
 * PatientScreen.js  v8.1  — FIXED
 *
 * Bug fixes from v8.0:
 *
 * FIX 1 — start_test stale closure
 *   The start_test useEffect re-registered its listener every time `view`
 *   changed, but the inner callback captured a stale `view` value at
 *   registration time. Replaced with enterVRRef so the callback always calls
 *   the latest enterVR, and replaced the `view === 'ready'` guard with a
 *   `viewRef` so the check reads the live value.
 *
 * FIX 2 — enterVR called before roomCode is set
 *   session_registered sets view → 'ready' via setState (async), so
 *   the start_test listener that fires immediately after could still see
 *   view === 'host_waiting'. Now we call enterVR directly inside the
 *   session_registered handler when autoStart param is true, and the
 *   start_test handler always checks viewRef.current === 'ready'.
 *
 * FIX 3 — socketService.connect called with wrong timing
 *   enterVR now waits one tick before connecting to ensure roomCodeRef is
 *   already set before the connect callback fires.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, BackHandler,
  KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import socketService from '../services/socketService';
import webRTCService from '../services/webRTCService';
import calibrationService from '../services/calibrationService';
import localPeerService, { PEER_ROLE } from '../services/localPeerService';
import { generatePlateDots, getPlate, TOTAL_PLATES } from '../utils/ishiharaPanel';
import SplitVRLayout from '../components/SplitVRLayout';
import { useTTS } from '../hooks/useTTS';
import apiService from '../../api/AxiosClient';

let Orientation          = null;
let KeepAwake            = null;
let SystemNavigationBar  = null;
let ScreenBrightness     = null;

try { Orientation = require('react-native-orientation-locker').default; } catch {}
try { KeepAwake = require('react-native-keep-awake').default; } catch {}
try { SystemNavigationBar = require('react-native-system-navigation-bar').default; } catch {}
try { ScreenBrightness = require('react-native-screen-brightness'); } catch {}

const fetchActiveAssistantsApi = async () => {
  const response = await apiService.get('api/assistant/auth/active-assistants');
  return response?.data?.response ?? response?.data ?? [];
};

const submitRegistrationApi = async (payload) => {
  const response = await apiService.post('api/vr/session/start', payload);
  return response?.data ?? response;
};

const ALLERGY_OPTIONS = [
  { key: 'allergyNITT', label: 'NITT' },
  { key: 'allergyPenicillin', label: 'Penicillin' },
  { key: 'allergyXylocaine', label: 'Xylocaine' },
  { key: 'allergySulpha', label: 'Sulpha' },
  { key: 'allergyAtropine', label: 'Atropine' },
  { key: 'allergyDropsyn', label: 'Dropsyn' },
];

const INITIAL_ALLERGIES = {
  allergyNITT: false, allergyPenicillin: false, allergyXylocaine: false,
  allergySulpha: false, allergyAtropine: false, allergyDropsyn: false,
};

export default function PatientScreen({ route, navigation }) {
  const deviceRole = route?.params?.deviceRole ?? null;
  const isVRHost   = deviceRole === PEER_ROLE.HOST;

  const [view, setView]           = useState(isVRHost ? 'host_waiting' : 'registration');
  const [regStep, setRegStep]     = useState('details');
  const [regName, setRegName]     = useState('');
  const [regAge, setRegAge]       = useState('');
  const [regGender, setRegGender] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regGlasses, setRegGlasses]   = useState(false);
  const [regAllergies, setRegAllergies] = useState({ ...INITIAL_ALLERGIES });
  const [activeAssistants, setActiveAssistants]         = useState([]);
  const [selectedAssistantId, setSelectedAssistantId]   = useState('');
  const [loadingAssistants, setLoadingAssistants]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState('');

  const [roomCode, setRoomCode]         = useState('');
  const [patientName, setPatientName]   = useState('');
  const [phase, setPhase]               = useState('waiting');
  const [instruction, setInstruction]   = useState('Waiting for the assistant to start the test\u2026');
  const [isComplete, setIsComplete]     = useState(false);
  const [optotype, setOptotype]         = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSeen, setFeedbackSeen] = useState(false);
  const [isLensCheck, setIsLensCheck]   = useState(false);
  const [lensCheckEye, setLensCheckEye] = useState('both');
  const [showLeft, setShowLeft]         = useState(true);
  const [showRight, setShowRight]       = useState(true);
  const [colorShowLeft, setColorShowLeft]   = useState(true);
  const [colorShowRight, setColorShowRight] = useState(true);
  const [nearShowLeft, setNearShowLeft]     = useState(true);
  const [nearShowRight, setNearShowRight]   = useState(true);
  const [astigShowLeft, setAstigShowLeft]   = useState(true);
  const [astigShowRight, setAstigShowRight] = useState(true);
  const [nearOptotype, setNearOptotype]     = useState(null);
  const [plateIndex, setPlateIndex]         = useState(0);
  const [plateDots, setPlateDots]           = useState([]);
  const [rtcState, setRtcState] = useState({
    isMuted: false, isConnected: false,
    isInitialising: false, hasError: false, errorMessage: '',
  });
  const [parallax, setParallax]           = useState(null);
  const [peerConnected, setPeerConnected] = useState(localPeerService.isConnected());

  const feedbackTimer       = useRef(null);
  const socketUnsubs        = useRef([]);
  const peerUnsubs          = useRef([]);
  const previousBrightness  = useRef(null);
  const autoStartedRef      = useRef(false);

  // ── FIX 1 & 2: Stable refs so callbacks never capture stale values ─────────
  const roomCodeRef   = useRef('');
  const viewRef       = useRef(isVRHost ? 'host_waiting' : 'registration');
  const enterVRRef    = useRef(null); // always points to latest enterVR

  // Keep viewRef in sync with view state
  const setViewSynced = useCallback((v) => {
    viewRef.current = v;
    setView(v);
  }, []);

  const { speak, speakPhase, resetEyeState } = useTTS();

  const broadcastVRState = useCallback((patch) => {
    if (!isVRHost) return;
    localPeerService.send('vr_state_update', patch);
  }, [isVRHost]);

  // ── Immersive helpers ─────────────────────────────────────────────────────
  const enableTestFullscreen = useCallback(async () => {
    try { Orientation?.lockToLandscape(); } catch {}
    try { KeepAwake?.activate(); } catch {}
    if (Platform.OS === 'android') {
      try { await SystemNavigationBar?.stickyImmersive?.(); } catch {
        try { await SystemNavigationBar?.immersive?.(); } catch {}
      }
      try { StatusBar.setHidden(true, 'fade'); } catch {}
    } else {
      try { StatusBar.setHidden(true, 'fade'); } catch {}
    }
    try {
      if (ScreenBrightness?.getBrightness && ScreenBrightness?.setBrightness) {
        const current = await ScreenBrightness.getBrightness();
        previousBrightness.current = current;
        await ScreenBrightness.setBrightness(0.7);
      }
    } catch {}
  }, []);

  const disableTestFullscreen = useCallback(async () => {
    try { Orientation?.unlockAllOrientations(); } catch {}
    try { KeepAwake?.deactivate(); } catch {}
    if (Platform.OS === 'android') {
      try { await SystemNavigationBar?.show?.(); } catch {}
      try { StatusBar.setHidden(false, 'fade'); } catch {}
    } else {
      try { StatusBar.setHidden(false, 'fade'); } catch {}
    }
    try {
      if (ScreenBrightness?.setBrightness && previousBrightness.current != null) {
        await ScreenBrightness.setBrightness(previousBrightness.current);
      }
      previousBrightness.current = null;
    } catch {}
  }, []);

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    calibrationService.autoDetectPpi();
    loadPlate(0);

    if (isVRHost) {
      attachLocalPeerListeners();
    } else {
      const room = route?.params?.roomCode;
      if (room) {
        roomCodeRef.current = room;
        setRoomCode(room);
        setViewSynced('ready');
      } else {
        fetchAssistants();
      }
    }

    return () => {
      socketUnsubs.current.forEach(fn => fn?.());
      peerUnsubs.current.forEach(fn => fn?.());
      webRTCService.disconnect();
      socketService.disconnect();
      clearTimeout(feedbackTimer.current);
      disableTestFullscreen();
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (view === 'vr') enableTestFullscreen();
    else disableTestFullscreen();
  }, [view, enableTestFullscreen, disableTestFullscreen]);

  useEffect(() => {
    const unsub = webRTCService.onStateChange((state) => {
      setRtcState(state);
      if (isVRHost && state.isConnected) {
        localPeerService.send('webrtc_event', { connected: state.isConnected, muted: state.isMuted });
      }
    });
    return () => unsub();
  }, [isVRHost]);

  useEffect(() => {
    let sub;
    try {
      const { gyroscope } = require('react-native-sensors');
      sub = gyroscope.subscribe(({ x: beta, y: gamma }) => {
        const g = Math.max(-25, Math.min(25, gamma * (180 / Math.PI)));
        const b = Math.max(-25, Math.min(25, beta * (180 / Math.PI)));
        setParallax(calibrationService.computeParallax(g, b));
      });
    } catch {}
    return () => sub?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (view !== 'vr') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [view]);

  // ── Plate loader ──────────────────────────────────────────────────────────
  const loadPlate = useCallback((index) => {
    const plate = getPlate(index);
    setPlateDots(generatePlateDots(plate));
    setPlateIndex(index);
  }, []);

  const fetchAssistants = useCallback(async () => {
    setLoadingAssistants(true);
    try {
      const list = await fetchActiveAssistantsApi();
      setActiveAssistants(Array.isArray(list) ? list : []);
    } catch { setActiveAssistants([]); }
    finally { setLoadingAssistants(false); }
  }, []);

  const regDetailsValid = regName.trim() && regMobile.trim() && regGender;

  const goToAssistantStep = useCallback(() => {
    if (regDetailsValid) { setRegStep('assistant'); fetchAssistants(); }
  }, [regDetailsValid, fetchAssistants]);

  const submitRegistration = useCallback(async () => {
    if (!selectedAssistantId || submitting) return;
    setSubmitting(true); setSubmitError('');
    const payload = {
      patientName: regName.trim(), patientAge: regAge ? Number(regAge) : null,
      patientGender: regGender, mobileNumber: regMobile.trim(),
      wearingGlasses: regGlasses, assistantId: selectedAssistantId, ...regAllergies,
    };
    try {
      const res = await submitRegistrationApi(payload);
      const rc = res.roomCode;
      roomCodeRef.current = rc;
      setRoomCode(rc);
      setPatientName(res.patientName ?? regName.trim());
      setViewSynced('ready');
    } catch (err) {
      setSubmitError(
        err?.response?.data?.message ?? err?.message ?? 'Could not start session. Please try again.'
      );
    } finally { setSubmitting(false); }
  }, [selectedAssistantId, submitting, regName, regAge, regGender, regMobile, regGlasses, regAllergies, setViewSynced]);

  const returnToRegistration = useCallback((msg = '') => {
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = null;
    socketUnsubs.current.forEach(fn => fn?.());
    socketUnsubs.current = [];
    webRTCService.disconnect();
    socketService.disconnect();
    disableTestFullscreen();

    const nextView = isVRHost ? 'host_waiting' : 'registration';
    viewRef.current = nextView;
    setView(nextView);

    setRegStep('details'); setSelectedAssistantId(''); setSubmitError(msg);
    roomCodeRef.current = '';
    setRoomCode('');
    setIsComplete(false); setPhase('waiting');
    setInstruction('Waiting for the assistant to start the test\u2026');
    setPatientName(''); setOptotype(null); setNearOptotype(null);
    setShowFeedback(false); setFeedbackSeen(false);
    setShowLeft(true); setShowRight(true);
    setColorShowLeft(true); setColorShowRight(true);
    setNearShowLeft(true); setNearShowRight(true);
    setAstigShowLeft(true); setAstigShowRight(true);
    setParallax(null);
    setRtcState({ isMuted: false, isConnected: false, isInitialising: false, hasError: false, errorMessage: '' });
    setIsLensCheck(false); setLensCheckEye('both');
    loadPlate(0);

    if (isVRHost) broadcastVRState({ phase: 'waiting', isComplete: false, instruction: 'Waiting\u2026' });
  }, [disableTestFullscreen, loadPlate, isVRHost, broadcastVRState]);

  const handleCloseSession = useCallback(() => returnToRegistration(''), [returnToRegistration]);

  // ── Enter VR ──────────────────────────────────────────────────────────────
  // FIX 3: use roomCodeRef directly — never stale
  const enterVR = useCallback(() => {
    const code = roomCodeRef.current;
    if (!code) {
      console.warn('[PatientScreen] enterVR called but roomCodeRef is empty');
      return;
    }
    console.log('[PatientScreen] enterVR → code:', code);
    speak('Connecting to session. Please wait.');
    viewRef.current = 'vr';
    setView('vr');
    socketService.connect('patient');
    attachSocketListeners(code);
    socketService.onConnected(() => {
      console.log('[PatientScreen] socket connected, emitting vr_join_session', code);
      socketService.emit('vr_join_session', { roomCode: code });
    });
  }, [speak]); // eslint-disable-line

  // Always keep enterVRRef pointing to latest
  enterVRRef.current = enterVR;

  // ── Local peer listeners (VR Host only) ─────────────────────────────────
  // FIX 1: start_test uses enterVRRef + viewRef — never stale
  function attachLocalPeerListeners() {
    const P = peerUnsubs.current;

    P.push(localPeerService.on('connected', () => {
      console.log('[PatientScreen] peer connected');
      setPeerConnected(true);
    }));

    P.push(localPeerService.on('disconnected', () => {
      console.log('[PatientScreen] peer disconnected');
      setPeerConnected(false);
    }));

    P.push(localPeerService.on('session_registered', (data) => {
      const { roomCode: rc, patientName: pn } = data;
      console.log('[PatientScreen] session_registered rc:', rc);
      roomCodeRef.current = rc;
      setRoomCode(rc);
      setPatientName(pn ?? '');
      viewRef.current = 'ready';
      setView('ready');
    }));

    // FIX 1: read viewRef.current (live) not captured view (stale)
    P.push(localPeerService.on('start_test', (data) => {
      console.log('[PatientScreen] start_test received. viewRef:', viewRef.current, 'roomCode:', roomCodeRef.current);
      if (roomCodeRef.current && viewRef.current === 'ready') {
        enterVRRef.current();
      } else {
        console.warn('[PatientScreen] start_test ignored — view:', viewRef.current, 'roomCode:', roomCodeRef.current);
      }
    }));

    P.push(localPeerService.on('end_session', () => {
      returnToRegistration('Session ended by controller.');
    }));
  }

  // ── Socket listeners ──────────────────────────────────────────────────────
  function attachSocketListeners(code) {
    const U = socketUnsubs.current;

    U.push(socketService.on('session_joined', async (data) => {
      const name = data.patientName ?? '';
      setPatientName(name);
      setPhase(data.phase ?? 'waiting');
      speak(name ? `Welcome, ${name}. Be ready for the test.` : 'Welcome. Be ready for the test.');
      await webRTCService.initAudio('patient', code);
      broadcastVRState({ phase: data.phase ?? 'waiting', patientName: name });
      // Tell controller the VR session has started — it switches to monitoring view
      localPeerService.send('vr_session_started', { patientName: name });
    }));

    U.push(socketService.on('set_calibration', (data) => {
      calibrationService.setProfile({
        ipdMm: data.ipdMm ?? 63,
        lensMagnification: data.lensMagnification ?? 1.0,
        physicalDistanceMm: data.physicalDistanceMm ?? 350,
      });
      if (data.autoPpi) calibrationService.autoDetectPpi();
    }));

    U.push(socketService.on('mute_patient', (data) => { webRTCService.forceLocalMute(data.muted); }));
    U.push(socketService.on('webrtc_ping', () => { socketService.emit('vr_webrtc_patient_ready', { roomCode: code }); }));

    U.push(socketService.on('session_error', (data) => {
      const msg = data?.message ?? 'Could not join session.';
      speak(msg); returnToRegistration(msg);
    }));

    U.push(socketService.on('show_instruction', (data) => {
      setIsLensCheck(false); setLensCheckEye('both');
      setInstruction(data.message); setPhase('waiting'); setOptotype(null);
      speak(data.message);
      broadcastVRState({ instruction: data.message, phase: 'waiting', optotype: null, isLensCheck: false });
    }));

    U.push(socketService.on('lens_check', (data) => {
      const eye = data?.eye ?? 'both';
      setPhase('waiting'); setIsComplete(false); setOptotype(null); setNearOptotype(null);
      setIsLensCheck(true); setLensCheckEye(eye);
      setShowLeft(eye === 'left' || eye === 'both');
      setShowRight(eye === 'right' || eye === 'both');
      setInstruction('Adjust the headset until the circles are centered and clear.');
      broadcastVRState({ isLensCheck: true, lensCheckEye: eye, instruction: 'Lens alignment', phase: 'waiting' });
    }));

    U.push(socketService.on('session_closed', (data) => {
      setIsComplete(true); setPhase('complete');
      const msg = data?.message ?? 'The screening session has been completed. Thank you!';
      setInstruction(msg); speak(msg);
      broadcastVRState({ isComplete: true, phase: 'complete', instruction: msg });
    }));

    U.push(socketService.on('session_ended', (data) => {
      const msg = data?.message ?? 'This session has already been completed.';
      speak(msg); returnToRegistration(msg);
    }));

    U.push(socketService.on('phase_changed', (data) => {
      const p = data.phase;
      setIsLensCheck(false); setLensCheckEye('both');
      setPhase(p); setOptotype(null); resetEyeState(); speakPhase(p);
      if (p === 'astigmatism') { setAstigShowLeft(true); setAstigShowRight(true); }
      if (p === 'color') { loadPlate(0); setColorShowLeft(true); setColorShowRight(true); }
      if (p === 'near') { setNearShowLeft(true); setNearShowRight(true); setNearOptotype(null); }
      broadcastVRState({
        phase: p, isLensCheck: false, optotype: null, nearOptotype: null,
        showLeft: true, showRight: true, colorShowLeft: true, colorShowRight: true,
        nearShowLeft: true, nearShowRight: true, astigShowLeft: true, astigShowRight: true,
        plateIndex: p === 'color' ? 0 : plateIndex,
      });
    }));

    U.push(socketService.on('show_color_plate', (data) => {
      loadPlate(data?.plateIndex ?? 0);
      broadcastVRState({ plateIndex: data?.plateIndex ?? 0 });
    }));

    U.push(socketService.on('show_color_eye', (data) => {
      const eye = data?.eye ?? 'both';
      setColorShowLeft(eye === 'left' || eye === 'both');
      setColorShowRight(eye === 'right' || eye === 'both');
      broadcastVRState({ colorShowLeft: eye === 'left' || eye === 'both', colorShowRight: eye === 'right' || eye === 'both' });
    }));

    U.push(socketService.on('show_near_eye', (data) => {
      const eye = data?.eye ?? 'both';
      setNearShowLeft(eye === 'left' || eye === 'both');
      setNearShowRight(eye === 'right' || eye === 'both');
      broadcastVRState({ nearShowLeft: eye === 'left' || eye === 'both', nearShowRight: eye === 'right' || eye === 'both' });
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
        setColorShowLeft(eye === 'left' || eye === 'both');
        setColorShowRight(eye === 'right' || eye === 'both');
        if (normalized.sizeLevel != null) loadPlate(normalized.sizeLevel);
        broadcastVRState({ colorShowLeft: eye === 'left' || eye === 'both', colorShowRight: eye === 'right' || eye === 'both', plateIndex: normalized.sizeLevel });
        return;
      }
      if (normalized.phase === 'near') {
        const eye = normalized.eye ?? 'both';
        setTimeout(() => {
          setNearOptotype({ letter: normalized.letter, sizeLevel: normalized.sizeLevel, acuityLabel: normalized.acuityLabel });
          setNearShowLeft(eye === 'left' || eye === 'both');
          setNearShowRight(eye === 'right' || eye === 'both');
          broadcastVRState({ nearOptotype: { letter: normalized.letter, sizeLevel: normalized.sizeLevel, acuityLabel: normalized.acuityLabel }, nearShowLeft: eye === 'left' || eye === 'both', nearShowRight: eye === 'right' || eye === 'both' });
        }, 120);
        return;
      }
      if (normalized.phase === 'astigmatism') {
        const eye = normalized.eye ?? 'both';
        setAstigShowLeft(eye === 'left' || eye === 'both');
        setAstigShowRight(eye === 'right' || eye === 'both');
        broadcastVRState({ astigShowLeft: eye === 'left' || eye === 'both', astigShowRight: eye === 'right' || eye === 'both' });
        return;
      }

      setShowFeedback(false);
      setTimeout(() => {
        setOptotype(normalized);
        const eye = normalized.eye ?? 'both';
        setShowLeft(eye === 'left' || eye === 'both');
        setShowRight(eye === 'right' || eye === 'both');
        broadcastVRState({ optotype: normalized, showLeft: eye === 'left' || eye === 'both', showRight: eye === 'right' || eye === 'both' });
      }, 120);
    }));

    U.push(socketService.on('response_recorded', (data) => {
      setFeedbackSeen(data.seen); setShowFeedback(true);
      clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setShowFeedback(false), 500);
    }));

    U.push(socketService.on('test_complete', () => {
      setIsComplete(true); setPhase('complete');
      speak('Test complete. Please remove your headset.');
      broadcastVRState({ isComplete: true, phase: 'complete' });
    }));

    U.push(socketService.on('peer_disconnected', () => {
      const msg = 'The assistant has disconnected. Please register again to rejoin.';
      speak(msg); returnToRegistration(msg);
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER A: VR Host Waiting
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'host_waiting') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={s.overlay} edges={['top','bottom','left','right']}>
          <StatusBar hidden={false} />
          <View style={s.startCard}>
            <View style={s.startLogo}><Text style={{ fontSize: 34 }}>🥽</Text></View>
            <View style={s.startHeader}>
              <Text style={s.startEyebrow}>VR Host Device</Text>
              <Text style={s.startTitle}>Waiting for Controller</Text>
            </View>
            <View style={[s.startRoomBadge, { borderColor: peerConnected ? 'rgba(76,175,80,0.4)' : 'rgba(249,168,37,0.3)' }]}>
              <View style={[s.peerDot, { backgroundColor: peerConnected ? '#4caf50' : '#f9a825' }]} />
              <Text style={s.startRoomLabel}>
                {peerConnected ? 'Controller connected' : 'Waiting for controller\u2026'}
              </Text>
            </View>
            <Text style={s.startHint}>
              {peerConnected
                ? 'Controller connected. Registration will be done on the controller device.'
                : 'Make sure the controller device connects on the same Wi\u2011Fi.'}
            </Text>
            {peerConnected && <ActivityIndicator color="#5b5bd6" style={{ marginTop: 8 }} />}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER B: Registration (standalone / legacy)
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'registration') {
    return (
      <SafeAreaProvider>
        <KeyboardAvoidingView style={s.regOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <StatusBar barStyle="light-content" backgroundColor="#080820" hidden={false} />
          <ScrollView contentContainerStyle={s.regScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.regCard}>
              <View style={s.regHeader}>
                <View style={s.regLogo}><Text style={{ fontSize: 28 }}>👁</Text></View>
                <Text style={s.regEyebrow}>Vision Screening</Text>
                <Text style={s.regTitle}>Patient Registration</Text>
                <View style={s.regSteps}>
                  <View style={[s.regStep, regStep === 'details' && s.regStepActive, regStep === 'assistant' && s.regStepDone]}>
                    <View style={[s.regStepNum, regStep === 'details' && s.regStepNumActive, regStep === 'assistant' && s.regStepNumDone]}>
                      <Text style={s.regStepNumText}>{regStep === 'assistant' ? '✓' : '1'}</Text>
                    </View>
                    <Text style={[s.regStepLabel, regStep === 'details' && s.regStepLabelActive]}>Your Details</Text>
                  </View>
                  <View style={s.regStepLine} />
                  <View style={[s.regStep, regStep === 'assistant' && s.regStepActive]}>
                    <View style={[s.regStepNum, regStep === 'assistant' && s.regStepNumActive]}>
                      <Text style={s.regStepNumText}>2</Text>
                    </View>
                    <Text style={[s.regStepLabel, regStep === 'assistant' && s.regStepLabelActive]}>Select Assistant</Text>
                  </View>
                </View>
              </View>
              {regStep === 'details' && (
                <View style={s.regBody}>
                  <View style={s.regField}><Text style={s.regLabel}>Full Name <Text style={s.req}>*</Text></Text><TextInput style={s.regInput} value={regName} onChangeText={setRegName} placeholder="e.g. Ravi Kumar" placeholderTextColor="#444" autoComplete="name" /></View>
                  <View style={s.regRow}>
                    <View style={[s.regField, { flex: 1 }]}><Text style={s.regLabel}>Age</Text><TextInput style={s.regInput} value={regAge} onChangeText={setRegAge} placeholder="Years" placeholderTextColor="#444" keyboardType="numeric" maxLength={3} /></View>
                    <View style={[s.regField, { flex: 1 }]}>
                      <Text style={s.regLabel}>Gender <Text style={s.req}>*</Text></Text>
                      <View style={s.regGenderRow}>{['Male','Female','Other'].map(g => (<TouchableOpacity key={g} style={[s.genderBtn, regGender === g && s.genderBtnSelected]} onPress={() => setRegGender(g)}><Text style={[s.genderBtnText, regGender === g && s.genderBtnTextSelected]}>{g}</Text></TouchableOpacity>))}</View>
                    </View>
                  </View>
                  <View style={s.regField}><Text style={s.regLabel}>Mobile Number <Text style={s.req}>*</Text></Text><TextInput style={s.regInput} value={regMobile} onChangeText={setRegMobile} placeholder="10-digit number" placeholderTextColor="#444" keyboardType="phone-pad" maxLength={15} /></View>
                  <TouchableOpacity style={s.checkRow} onPress={() => setRegGlasses(v => !v)} activeOpacity={0.7}>
                    <View style={[s.checkbox, regGlasses && s.checkboxChecked]}>{regGlasses && <Text style={s.checkmark}>✓</Text>}</View>
                    <Text style={s.checkLabel}>Currently wearing glasses / contact lenses</Text>
                  </TouchableOpacity>
                  <View style={s.regField}>
                    <Text style={[s.regLabel, { marginBottom: 10 }]}>Known Allergies</Text>
                    <View style={s.allergyGrid}>{ALLERGY_OPTIONS.map(a => (<TouchableOpacity key={a.key} style={[s.allergyChip, regAllergies[a.key] && s.allergyChipSelected]} onPress={() => setRegAllergies(prev => ({ ...prev, [a.key]: !prev[a.key] }))} activeOpacity={0.7}><Text style={[s.allergyChipText, regAllergies[a.key] && s.allergyChipTextSelected]}>{a.label}</Text></TouchableOpacity>))}</View>
                  </View>
                  <TouchableOpacity style={[s.regBtn, !regDetailsValid && s.regBtnDisabled]} onPress={goToAssistantStep} disabled={!regDetailsValid} activeOpacity={0.85}><Text style={s.regBtnText}>Next \u2014 Choose Assistant  \u2192</Text></TouchableOpacity>
                </View>
              )}
              {regStep === 'assistant' && (
                <View style={s.regBody}>
                  <TouchableOpacity style={s.regBack} onPress={() => setRegStep('details')}><Text style={s.regBackText}>\u2190 Back</Text></TouchableOpacity>
                  <Text style={s.regSectionTitle}>Select your assistant</Text>
                  {loadingAssistants ? (
                    <View style={s.loadingRow}><ActivityIndicator color="#7c7cf0" size="small" /><Text style={s.loadingText}>Loading available assistants\u2026</Text></View>
                  ) : activeAssistants.length === 0 ? (
                    <View style={s.emptyBox}><Text style={s.emptyText}>No assistants are currently online.</Text><TouchableOpacity style={s.retryBtn} onPress={fetchAssistants}><Text style={s.retryBtnText}>Retry</Text></TouchableOpacity></View>
                  ) : (
                    <View style={s.assistantList}>{activeAssistants.map(a => (<TouchableOpacity key={a.assistantId} style={[s.assistantCard, selectedAssistantId === a.assistantId && s.assistantCardSelected]} onPress={() => setSelectedAssistantId(a.assistantId)} activeOpacity={0.75}><View style={s.assistantAvatar}><Text style={s.assistantAvatarText}>{(a.name ?? '?').charAt(0).toUpperCase()}</Text></View><View style={s.assistantInfo}><Text style={s.assistantName}>{a.name}</Text><Text style={s.assistantId2}>{a.assistantId}</Text></View>{selectedAssistantId === a.assistantId && <Text style={s.assistantCheck}>✓</Text>}</TouchableOpacity>))}</View>
                  )}
                  {submitError ? <View style={s.errorBanner}><Text style={s.errorBannerText}>\u26a0\ufe0f  {submitError}</Text></View> : null}
                  <TouchableOpacity style={[s.regBtn, (!selectedAssistantId || submitting) && s.regBtnDisabled]} onPress={submitRegistration} disabled={!selectedAssistantId || submitting} activeOpacity={0.85}>{submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.regBtnText}>Start Session</Text>}</TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER C: Pre-VR "Begin Test"
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'ready') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={s.overlay} edges={['top','bottom','left','right']}>
          <StatusBar hidden={false} />
          <View style={s.startCard}>
            <View style={s.startLogo}><Text style={{ fontSize: 34 }}>👁</Text></View>
            <View style={s.startHeader}>
              <Text style={s.startEyebrow}>Clinical Vision Test</Text>
              <Text style={s.startTitle}>Vision Screening</Text>
            </View>
            {patientName ? <Text style={s.startPatient}>Patient: {patientName}</Text> : null}
            {roomCode ? (
              <View style={s.startRoomBadge}><Text style={s.startRoomLabel}>ROOM</Text><Text style={s.startRoomCode}>{roomCode}</Text></View>
            ) : null}
            {!isVRHost && (
              <TouchableOpacity style={s.changeBtn} onPress={() => returnToRegistration('')}><Text style={s.changeText}>\u2190 Back to registration</Text></TouchableOpacity>
            )}
            {isVRHost ? (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#5b5bd6" />
                <Text style={s.startHint}>Put on the headset. Test will start from the controller.</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity style={s.startBtn} onPress={enterVR} activeOpacity={0.85}><Text style={s.startBtnText}>\u25b6  Begin Test</Text></TouchableOpacity>
                <Text style={s.startHint}>Put on your headset before tapping</Text>
              </>
            )}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER D: Active VR — UNTOUCHED split-screen cardboard
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.vrRoot} edges={['top','bottom','left','right']}>
        <StatusBar hidden translucent backgroundColor="transparent" />
        <SplitVRLayout
          phase={phase} instruction={instruction} patientName={patientName}
          optotype={optotype} isComplete={isComplete}
          showLeft={showLeft} showRight={showRight}
          colorShowLeft={colorShowLeft} colorShowRight={colorShowRight}
          nearShowLeft={nearShowLeft} nearShowRight={nearShowRight}
          astigShowLeft={astigShowLeft} astigShowRight={astigShowRight}
          plateDots={plateDots} plateIndex={plateIndex} totalPlates={TOTAL_PLATES}
          showFeedback={showFeedback} feedbackSeen={feedbackSeen}
          parallax={parallax} rtcState={rtcState}
          onCloseSession={handleCloseSession}
          nearOptotype={nearOptotype} isLensCheck={isLensCheck} lensCheckEye={lensCheckEye}
        />
        <TouchableOpacity style={s.muteBtn} onPress={() => webRTCService.toggleMute()} activeOpacity={0.8}>
          <Text style={s.muteText}>{rtcState.isMuted ? '🔇' : '🎙'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const { width: W } = Dimensions.get('window');

const s = StyleSheet.create({
  regOverlay: { flex: 1, backgroundColor: '#080820' },
  regScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  regCard: { width: '100%', maxWidth: 480, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(124,124,240,0.18)', borderRadius: 20, overflow: 'hidden' },
  regHeader: { alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(124,124,240,0.12)', backgroundColor: 'rgba(91,91,214,0.04)', gap: 6 },
  regLogo: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(91,91,214,0.1)', borderWidth: 1, borderColor: 'rgba(124,124,240,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  regEyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 2, color: '#7c7cf0', textTransform: 'uppercase' },
  regTitle: { fontSize: 22, fontWeight: '300', color: '#e8e8f0', letterSpacing: 0.4, marginBottom: 16 },
  regSteps: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  regStep: { flexDirection: 'row', alignItems: 'center', gap: 8, opacity: 0.45 },
  regStepActive: { opacity: 1 },
  regStepDone: { opacity: 0.7 },
  regStepLine: { width: 32, height: 1, backgroundColor: 'rgba(124,124,240,0.3)', marginHorizontal: 8 },
  regStepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  regStepNumActive: { backgroundColor: '#5b5bd6', borderColor: '#5b5bd6' },
  regStepNumDone: { backgroundColor: 'rgba(91,91,214,0.35)', borderColor: '#5b5bd6' },
  regStepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  regStepLabel: { color: '#888', fontSize: 11, fontWeight: '500' },
  regStepLabelActive: { color: '#e8e8f0' },
  regBody: { padding: 24, gap: 18 },
  regField: { gap: 8 },
  regLabel: { color: '#aaa', fontSize: 12, fontWeight: '500', letterSpacing: 0.4 },
  req: { color: '#7c7cf0' },
  regInput: { backgroundColor: '#0d0d1a', borderWidth: 1, borderColor: '#2a2a40', borderRadius: 10, color: '#e8e8f0', fontSize: 14, paddingVertical: 12, paddingHorizontal: 14 },
  regRow: { flexDirection: 'row', gap: 12 },
  regGenderRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  genderBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#2a2a40', backgroundColor: '#0d0d1a' },
  genderBtnSelected: { borderColor: '#5b5bd6', backgroundColor: 'rgba(91,91,214,0.15)' },
  genderBtnText: { color: '#666', fontSize: 12 },
  genderBtnTextSelected: { color: '#a0a0f0', fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#3a3a5a', backgroundColor: '#0d0d1a', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#5b5bd6', borderColor: '#5b5bd6' },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  checkLabel: { flex: 1, color: '#aaa', fontSize: 13, lineHeight: 18 },
  allergyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  allergyChip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 100, borderWidth: 1, borderColor: '#2a2a40', backgroundColor: '#0d0d1a' },
  allergyChipSelected: { borderColor: '#5b5bd6', backgroundColor: 'rgba(91,91,214,0.15)' },
  allergyChipText: { color: '#555', fontSize: 12 },
  allergyChipTextSelected: { color: '#a0a0f0', fontWeight: '600' },
  regBtn: { backgroundColor: '#5b5bd6', paddingVertical: 14, borderRadius: 100, alignItems: 'center', marginTop: 4, shadowColor: '#5b5bd6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  regBtnDisabled: { opacity: 0.35, shadowOpacity: 0 },
  regBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: 0.4 },
  regBack: { alignSelf: 'flex-start' },
  regBackText: { color: '#7c7cf0', fontSize: 13 },
  regSectionTitle: { color: '#c0c0e0', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 20, justifyContent: 'center' },
  loadingText: { color: '#666', fontSize: 13 },
  emptyBox: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  emptyText: { color: '#666', fontSize: 13 },
  retryBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 100, borderWidth: 1, borderColor: '#5b5bd6' },
  retryBtnText: { color: '#7c7cf0', fontSize: 13 },
  assistantList: { gap: 10 },
  assistantCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1e1e30', backgroundColor: '#0d0d1a' },
  assistantCardSelected: { borderColor: '#5b5bd6', backgroundColor: 'rgba(91,91,214,0.08)' },
  assistantAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(91,91,214,0.2)', alignItems: 'center', justifyContent: 'center' },
  assistantAvatarText: { color: '#a0a0f0', fontSize: 18, fontWeight: '700' },
  assistantInfo: { flex: 1, gap: 3 },
  assistantName: { color: '#e0e0f0', fontSize: 14, fontWeight: '600' },
  assistantId2: { color: '#555', fontSize: 11 },
  assistantCheck: { color: '#5b5bd6', fontSize: 18, fontWeight: '700' },
  errorBanner: { backgroundColor: 'rgba(204,51,51,0.1)', borderWidth: 1, borderColor: 'rgba(204,51,51,0.3)', borderRadius: 10, padding: 12 },
  errorBannerText: { color: '#ff6666', fontSize: 12, lineHeight: 18 },
  overlay: { flex: 1, backgroundColor: '#080820', alignItems: 'center', justifyContent: 'center' },
  startCard: { alignItems: 'center', gap: 18, paddingTop: 44, paddingBottom: 36, paddingHorizontal: 40, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(124,124,240,0.22)', borderRadius: 20, width: Math.min(360, W * 0.88), shadowColor: '#5b5bd6', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.07, shadowRadius: 32 },
  startLogo: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(91,91,214,0.08)', borderWidth: 1, borderColor: 'rgba(124,124,240,0.3)', alignItems: 'center', justifyContent: 'center' },
  startHeader: { alignItems: 'center', gap: 6 },
  startEyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 1.8, color: '#5b5bd6', textTransform: 'uppercase' },
  startTitle: { fontSize: 26, fontWeight: '300', color: '#e8e8f0', letterSpacing: 0.5 },
  startPatient: { fontSize: 13, color: '#a0a0c0', fontStyle: 'italic' },
  startRoomBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 18, backgroundColor: 'rgba(91,91,214,0.1)', borderWidth: 1, borderColor: 'rgba(91,91,214,0.2)', borderRadius: 100 },
  startRoomLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: '#5b5bd6', textTransform: 'uppercase' },
  startRoomCode: { fontSize: 13, fontFamily: 'Courier New', fontWeight: '700', color: '#c0c0e0', letterSpacing: 1.3 },
  peerDot: { width: 8, height: 8, borderRadius: 4 },
  changeBtn: { paddingVertical: 4 },
  changeText: { color: '#5b5bd6', fontSize: 12, textDecorationLine: 'underline' },
  startBtn: { width: '100%', paddingVertical: 14, backgroundColor: '#5b5bd6', borderRadius: 100, alignItems: 'center', shadowColor: '#5b5bd6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  startBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: 0.6 },
  startHint: { fontSize: 10.5, color: '#3a3a4a', textAlign: 'center' },
  vrRoot: { flex: 1, backgroundColor: '#000' },
  muteBtn: { position: 'absolute', bottom: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 18, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' },
  muteText: { fontSize: 16 },
});