/**
 * useTTS.js
 *
 * React Native TTS voice directions for every step and event in the
 * VR vision screening flow.
 *
 * Usage:
 *   const { speak, queue, speakPhase, speakEye } = useTTS();
 *
 * Dependencies:
 *   npm install react-native-tts
 *   (iOS: cd ios && pod install)
 *   (Android: auto-linked with RN >= 0.60)
 *
 * Fix (v6.1):
 *   speakEye now uses queue() instead of speak() so the eye direction
 *   chains AFTER the phase name instead of cutting it off mid-word.
 *
 *   speak(text) — stop current + play  (interrupts)
 *   queue(text) — play after current   (appends, no overlap)
 *
 *   phase_changed flow:
 *     speakPhase()  -> speak("Color vision test.")      <- interrupts
 *     speakEye()    -> queue("Use both eyes.")          <- plays after
 */

import { useEffect, useRef, useCallback } from 'react';

// Safe TTS import — falls back silently if the native module is absent
let Tts = null;
try {
  Tts = require('react-native-tts').default;
} catch {
  /* TTS native module not linked — all speak/queue calls will be no-ops */
}

// ── Voice script ──────────────────────────────────────────────────────────────

/** Spoken on phase transitions — test type name only */
export const PHASE_MESSAGES = {
  waiting:     'Please wait.',
  color:       'Color vision test.',
  near:        'Near vision test.',
  astigmatism: 'Astigmatism test.',
  acuity:      'Acuity test.',
  complete:    'Test complete. Please remove your headset.',
};

/** Spoken when the active eye changes — queued after phase name */
export const EYE_MESSAGES = {
  both:  'Say what you see.',
  left:  'Say what you see.',
  right: 'Say what you see.',
};

/** Derive a canonical eye key from two boolean flags */
export function eyeKey(showLeft, showRight) {
  if (showLeft && showRight) return 'both';
  if (showLeft)              return 'left';
  if (showRight)             return 'right';
  return null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTTS() {
  const ttsReady   = useRef(false);
  const lastEyeKey = useRef(null);

  // Initialise TTS once on mount
  useEffect(() => {
    if (!Tts) return;
    Tts.getInitStatus()
      .then(() => {
        ttsReady.current = true;
        Tts.setDefaultRate(0.50); // slightly slower — easier in headset
        Tts.setDefaultPitch(1.0);
      })
      .catch(() => { /* engine unavailable — stay silent */ });

    return () => { Tts?.stop?.(); };
  }, []);

  // speak — INTERRUPTS whatever is playing, then speaks text
  const speak = useCallback((text) => {
    if (!ttsReady.current || !Tts || !text) return;
    Tts.stop();
    Tts.speak(String(text));
  }, []);

  // queue — APPENDS text after whatever is already playing (no stop)
  // react-native-tts plays items sequentially when stop() is not called.
  const queue = useCallback((text) => {
    if (!ttsReady.current || !Tts || !text) return;
    Tts.speak(String(text)); // no Tts.stop() — chains after current utterance
  }, []);

  // speakPhase — interrupts with the phase name only.
  // Caller follows up with speakEye() which queues after this.
  const speakPhase = useCallback((phase) => {
    const msg = PHASE_MESSAGES[phase];
    if (msg) speak(msg);
  }, [speak]);

  // speakEye — queues eye direction only if the selection changed.
  // Uses queue() so it plays after a preceding phase name, never over it.
  const speakEye = useCallback((showLeft, showRight) => {
    const key = eyeKey(showLeft, showRight);
    if (!key || key === lastEyeKey.current) return;
    lastEyeKey.current = key;
    queue(EYE_MESSAGES[key]); // <- queue, not speak
  }, [queue]);

  // resetEyeState — clear tracker at phase transitions so the first
  // optotype of a new phase always re-announces the eye selection.
  const resetEyeState = useCallback(() => {
    lastEyeKey.current = null;
  }, []);

  return { speak, queue, speakPhase, speakEye, resetEyeState };
}