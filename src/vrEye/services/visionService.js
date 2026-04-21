/**
 * visionService.js  v3.0
 *
 * ── Source of truth: vision.service.ts ───────────────────────────────────────
 *
 * ACUITY_LEVELS — exact copy (diopter labels, sizeLevel 1-indexed, sizePx exact):
 *   { label: '0.00D',  sizeLevel: 1,  sizePx: 18,  diopters:  0.00 }
 *   ...
 *   { label: '-5.00D', sizeLevel: 21, sizePx: 180, diopters: -5.00 }
 *
 * showOptotype() — matches Angular exactly:
 *   const acuity = ACUITY_LEVELS[Math.min(level, ACUITY_LEVELS.length - 1)]
 *   emits: { sizeLevel: acuity.sizeLevel, sizePx: acuity.sizePx, acuityLabel: acuity.label }
 *
 * ── sizePx=0 fix ──────────────────────────────────────────────────────────────
 *   Angular uses a 1-indexed sizeLevel (1..21) and 0-indexed array access.
 *   When the React Native client sends sizeLevel=0 (from the initial staircase
 *   state before any response), the lookup returns undefined → sizePx falls
 *   to 0. Fix: Math.max(1, level) before array access, and safeSizePx guard.
 *
 *   The Angular AcuityEngineService.reset() starts index=5 (not 0), so the
 *   first optotype shown by the assistant will be sizeLevel=6 (index 5 + 1),
 *   sizePx=32. The sizeLevel=0 / sizePx=0 bug only happens if the client
 *   sends level=0 (before reset() is called). This fix guards both sides.
 */

import socketService from './socketService';
import { backendURL } from '../../AxiosClient';

// Exact copy from vision.service.ts
export const ACUITY_LEVELS = [
  { label: '0.00D',  sizeLevel: 1,  sizePx: 18,  diopters:  0.00 },
  { label: '-0.25D', sizeLevel: 2,  sizePx: 20,  diopters: -0.25 },
  { label: '-0.50D', sizeLevel: 3,  sizePx: 23,  diopters: -0.50 },
  { label: '-0.75D', sizeLevel: 4,  sizePx: 25,  diopters: -0.75 },
  { label: '-1.00D', sizeLevel: 5,  sizePx: 29,  diopters: -1.00 },
  { label: '-1.25D', sizeLevel: 6,  sizePx: 32,  diopters: -1.25 },
  { label: '-1.50D', sizeLevel: 7,  sizePx: 36,  diopters: -1.50 },
  { label: '-1.75D', sizeLevel: 8,  sizePx: 40,  diopters: -1.75 },
  { label: '-2.00D', sizeLevel: 9,  sizePx: 45,  diopters: -2.00 },
  { label: '-2.25D', sizeLevel: 10, sizePx: 51,  diopters: -2.25 },
  { label: '-2.50D', sizeLevel: 11, sizePx: 57,  diopters: -2.50 },
  { label: '-2.75D', sizeLevel: 12, sizePx: 64,  diopters: -2.75 },
  { label: '-3.00D', sizeLevel: 13, sizePx: 72,  diopters: -3.00 },
  { label: '-3.25D', sizeLevel: 14, sizePx: 80,  diopters: -3.25 },
  { label: '-3.50D', sizeLevel: 15, sizePx: 90,  diopters: -3.50 },
  { label: '-3.75D', sizeLevel: 16, sizePx: 101, diopters: -3.75 },
  { label: '-4.00D', sizeLevel: 17, sizePx: 114, diopters: -4.00 },
  { label: '-4.25D', sizeLevel: 18, sizePx: 127, diopters: -4.25 },
  { label: '-4.50D', sizeLevel: 19, sizePx: 143, diopters: -4.50 },
  { label: '-4.75D', sizeLevel: 20, sizePx: 160, diopters: -4.75 },
  { label: '-5.00D', sizeLevel: 21, sizePx: 180, diopters: -5.00 },
];

export const ROTATIONS = [0, 90, 180, 270];

class VisionService {
  constructor() {
    this.roomCode          = '';
    this.phase             = 'waiting';
    this.currentOptotype   = null;
    // Matches Angular: private acuityIndex = { right: 0, left: 0, both: 0 }
    this._acuityIndex      = { right: 0, left: 0, both: 0 };
    this._consecutiveWrong = { right: 0, left: 0, both: 0 };
    this._stateListeners   = [];
  }

  onStateChange(callback) {
    this._stateListeners.push(callback);
    return () => {
      this._stateListeners = this._stateListeners.filter(l => l !== callback);
    };
  }

  _notify() {
    const snapshot = {
      roomCode:        this.roomCode,
      phase:           this.phase,
      currentOptotype: this.currentOptotype,
    };
    this._stateListeners.forEach(l => l(snapshot));
  }

  async generateRoom() {
    const res = await fetch(`${backendURL}/api/vr/session/new`);
    return res.json();
  }

  async getServerInfo() {
    const res = await fetch(`${backendURL}/api/vr/server-info`);
    return res.json();
  }

  createSession(roomCode, patientName) {
    this.roomCode = roomCode;
    socketService.emit('vr_create_session', { roomCode, patientName });
    this._notify();
  }

  showInstruction(message) {
    socketService.emit('vr_show_instruction', { roomCode: this.roomCode, message });
  }

  setPhase(phase) {
    this.phase = phase;
    socketService.emit('vr_next_phase', { roomCode: this.roomCode, phase });
    this._notify();
  }

  /**
   * Show next optotype — matches Angular vision.service.ts showOptotype() exactly.
   *
   * Angular:
   *   const level  = forceLevel ?? this.acuityIndex[eyeKey];
   *   const acuity = ACUITY_LEVELS[Math.min(level, ACUITY_LEVELS.length - 1)];
   *
   * Fix: ACUITY_LEVELS is 0-indexed (21 items, indices 0..20).
   *      sizeLevel field is 1-indexed (values 1..21).
   *      When _acuityIndex=0, ACUITY_LEVELS[0] = { sizeLevel:1, sizePx:18 } ← correct.
   *      Emitted sizePx is always > 0 (safeSizePx guard below).
   */
  showOptotype(eye, forceLevel) {
    const level   = forceLevel ?? this._acuityIndex[eye];
    // Exact from Angular: ACUITY_LEVELS[Math.min(level, ACUITY_LEVELS.length - 1)]
    const acuity  = ACUITY_LEVELS[Math.min(level, ACUITY_LEVELS.length - 1)];
    const rotation = ROTATIONS[Math.floor(Math.random() * 4)];

    // Guard: sizePx must always be > 0 (undefined acuity = corrupted index)
    const safeSizePx = (acuity?.sizePx ?? 0) > 0 ? acuity.sizePx : 18;

    const optotype = {
      phase:       this.phase,
      letter:      'E',
      rotation,
      sizeLevel:   acuity?.sizeLevel ?? 1,    // 1-indexed, matches vision.service.ts
      sizePx:      safeSizePx,                 // guaranteed > 0
      eye,
      acuityLabel: acuity?.label ?? '0.00D',
    };

    this.currentOptotype = optotype;
    socketService.emit('vr_show_optotype', { roomCode: this.roomCode, ...optotype });
    this._notify();
  }

  // Exact from vision.service.ts recordResponse()
  recordResponse(eye, seen) {
    if (seen) {
      this._consecutiveWrong[eye] = 0;
      this._acuityIndex[eye] = Math.max(0, this._acuityIndex[eye] - 1);
    } else {
      this._consecutiveWrong[eye]++;
      this._acuityIndex[eye] = Math.min(
        ACUITY_LEVELS.length - 1,
        this._acuityIndex[eye] + 1,
      );
    }

    socketService.emit('vr_record_response', {
      roomCode:  this.roomCode,
      phase:     this.phase,
      eye,
      seen,
      sizeLevel: this._acuityIndex[eye],
    });

    return ACUITY_LEVELS[this._acuityIndex[eye]];
  }

  resetAcuity(eye) {
    this._acuityIndex[eye]      = 0;
    this._consecutiveWrong[eye] = 0;
  }

  getCurrentAcuity(eye) {
    return ACUITY_LEVELS[this._acuityIndex[eye]];
  }

  endTest() {
    socketService.emit('vr_end_test', { roomCode: this.roomCode });
  }

  async saveResult(result) {
    const res = await fetch(`${backendURL}/api/vr/results`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(result),
    });
    return res.json();
  }

  async getAllResults() {
    const res = await fetch(`${backendURL}/api/vr/results`);
    return res.json();
  }

  async deleteResult(id) {
    await fetch(`${backendURL}/api/vr/results/${id}`, { method: 'DELETE' });
  }
}

export default new VisionService();