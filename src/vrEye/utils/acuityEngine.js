/**
 * acuityEngine.js  v4.0
 *
 * ── Exact port of Angular acuity-engine.service.ts ───────────────────────────
 *
 *  Staircase algorithm:
 *    • REVERSAL_LIMIT = 8  (Angular source — previously 6 in old RN version)
 *    • Threshold = mean of LAST 4 reversal indices  (Angular uses slice(-4))
 *    • Default startIndex = 5  (6/15, −1.25 D)
 *    • High-myopia start: 10   (6/36, −2.50 D)
 *
 *  Uses ACUITY_ARCMIN from calibrationService (arcmin-based, NOT old sizePx table).
 *  calculateRisk() and generateRecommendation() are verbatim from Angular.
 */

import { ACUITY_ARCMIN } from './calibrationService';

// Exact from acuity-engine.service.ts
const REVERSAL_LIMIT = 8;

export class AcuityEngineService {
  constructor() {
    this._states = {};
  }

  /**
   * reset(eye, startIndex)
   *
   * Angular exact:
   *   reset(eye: string, startIndex = 5): void {
   *     this.states[eye] = {
   *       index: Math.max(0, Math.min(startIndex, ACUITY_ARCMIN.length - 1)),
   *       consecutiveWrong: 0,
   *       threshold: null,
   *       reversals: 0,
   *       lastSeen: null,
   *       reversalIndices: [],
   *     };
   *   }
   */
  reset(eye, startIndex = 5) {
    this._states[eye] = {
      index:            Math.max(0, Math.min(startIndex, ACUITY_ARCMIN.length - 1)),
      consecutiveWrong: 0,
      threshold:        null,
      reversals:        0,
      lastSeen:         null,
      reversalIndices:  [],   // Angular: tracks index at each reversal
    };
  }

  _getState(eye) {
    if (!this._states[eye]) this.reset(eye);
    return this._states[eye];
  }

  current(eye) {
    return ACUITY_ARCMIN[this._getState(eye).index];
  }

  currentIndex(eye) {
    return this._getState(eye).index;
  }

  /**
   * respond(eye, seen)
   *
   * Angular exact:
   *   respond(eye: string, seen: boolean): { entry, thresholdLocked } {
   *     if (st.lastSeen !== null && seen !== st.lastSeen) {
   *       st.reversals++;
   *       st.reversalIndices.push(st.index);   // ← record index at reversal
   *     }
   *     st.lastSeen = seen;
   *
   *     if (seen) { st.consecutiveWrong = 0; st.index = Math.max(0, st.index - 1); }
   *     else      { st.consecutiveWrong++; st.index = Math.min(len-1, st.index + 1); }
   *
   *     // Lock threshold at REVERSAL_LIMIT — average LAST 4 reversal indices
   *     if (st.reversals >= REVERSAL_LIMIT && st.threshold === null) {
   *       const last4 = st.reversalIndices.slice(-4);
   *       st.threshold = Math.round(last4.reduce((a, b) => a + b, 0) / last4.length);
   *     }
   *   }
   */
  respond(eye, seen) {
    const st = this._getState(eye);

    // Detect reversal
    if (st.lastSeen !== null && seen !== st.lastSeen) {
      st.reversals++;
      st.reversalIndices.push(st.index);
    }
    st.lastSeen = seen;

    if (seen) {
      st.consecutiveWrong = 0;
      st.index = Math.max(0, st.index - 1);
    } else {
      st.consecutiveWrong++;
      st.index = Math.min(ACUITY_ARCMIN.length - 1, st.index + 1);
    }

    // Threshold lock — average last 4 reversal indices (Angular: slice(-4))
    if (st.reversals >= REVERSAL_LIMIT && st.threshold === null) {
      const last4 = st.reversalIndices.slice(-4);
      st.threshold = Math.round(
        last4.reduce((a, b) => a + b, 0) / last4.length,
      );
    }

    return {
      entry:            ACUITY_ARCMIN[st.index],
      thresholdLocked:  st.threshold !== null,
    };
  }

  getThreshold(eye) {
    const st = this._states[eye];
    if (!st || st.threshold === null) return null;
    return ACUITY_ARCMIN[st.threshold];
  }

  isThresholdLocked(eye) {
    return this._states[eye]?.threshold !== null;
  }

  /**
   * calculateRisk — exact from acuity-engine.service.ts
   */
  calculateRisk(rightDiopters, leftDiopters) {
    const worst         = Math.min(rightDiopters, leftDiopters);
    const anisometropia = Math.abs(rightDiopters - leftDiopters);

    if (worst < -3.00 || anisometropia >= 2.00) return 'High';
    if (worst < -0.75 || anisometropia >= 1.00) return 'Moderate';
    return 'Low';
  }

  /**
   * generateRecommendation — exact from acuity-engine.service.ts
   */
  generateRecommendation(riskLevel, dioptersRight, dioptersLeft, colourDeficient, astigmatism) {
    const aniso = Math.abs(dioptersRight - dioptersLeft);

    if (riskLevel === 'High') {
      if (aniso >= 2.00) {
        return (
          `Urgent referral to ophthalmologist within 2 weeks — significant ` +
          `anisometropia (${aniso.toFixed(2)} D) detected; amblyopia risk.`
        );
      }
      return 'Urgent referral to ophthalmologist within 2 weeks — myopia > −3.00 D detected.';
    }

    if (riskLevel === 'Moderate') {
      const extras = [];
      if (colourDeficient) extras.push('colour deficiency noted');
      if (astigmatism)     extras.push('possible astigmatism');
      if (aniso >= 1.00)   extras.push(`anisometropia ${aniso.toFixed(2)} D — amblyopia risk`);
      const note = extras.length ? ` (${extras.join('; ')})` : '';
      return `Referral to optometrist within 3 months${note}.`;
    }

    return 'No urgent action required. Routine optometry review in 12 months recommended.';
  }
}

// Singleton
export const acuityEngine = new AcuityEngineService();
export default acuityEngine;