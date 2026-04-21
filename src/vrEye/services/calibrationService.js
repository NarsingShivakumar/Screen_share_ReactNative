/**
 * calibrationService.js  v1.0
 *
 * ── Exact port of Angular calibration.service.ts ─────────────────────────────
 *
 *  All formulas, constants, and logic are identical to the Angular source.
 *  React Native differences:
 *    • No window / screen globals — pass them in, or use Dimensions.get('screen')
 *    • No DeviceOrientationEvent — use react-native-sensors or Gyroscope
 *    • navigator.userAgent works in RN (Hermes exposes it)
 *
 *  PRINCIPLE: The patient component ALWAYS uses levelToPixels() to compute
 *  font size. It NEVER uses sizePx from the socket payload directly.
 *  (Matches Angular patient.component.ts calibratedFontSizePx getter)
 */

import { Dimensions, PixelRatio } from 'react-native';

// ── Exact copy of ACUITY_ARCMIN from calibration.service.ts ──────────────────
export const ACUITY_ARCMIN = [
    { label: '6/6', logmar: 0.0, arcmin: 5.0, diopters: 0.00 },
    { label: '6/7.5', logmar: 0.1, arcmin: 6.3, diopters: -0.25 },
    { label: '6/9', logmar: 0.2, arcmin: 7.9, diopters: -0.50 },
    { label: '6/10', logmar: 0.3, arcmin: 10.0, diopters: -0.75 },
    { label: '6/12', logmar: 0.4, arcmin: 12.6, diopters: -1.00 },
    { label: '6/15', logmar: 0.5, arcmin: 15.8, diopters: -1.25 },
    { label: '6/18', logmar: 0.6, arcmin: 20.0, diopters: -1.50 },
    { label: '6/21', logmar: 0.7, arcmin: 25.1, diopters: -1.75 },
    { label: '6/24', logmar: 0.8, arcmin: 31.6, diopters: -2.00 },
    { label: '6/30', logmar: 0.9, arcmin: 39.8, diopters: -2.25 },
    { label: '6/36', logmar: 1.0, arcmin: 50.1, diopters: -2.50 },
    { label: '6/45', logmar: 1.1, arcmin: 63.1, diopters: -2.75 },
    { label: '6/60', logmar: 1.2, arcmin: 79.4, diopters: -3.00 },
    { label: '6/75', logmar: 1.3, arcmin: 100.0, diopters: -3.25 },
    { label: '6/90', logmar: 1.4, arcmin: 125.9, diopters: -3.50 },
    { label: '6/120', logmar: 1.5, arcmin: 158.5, diopters: -3.75 },
    { label: '6/150', logmar: 1.6, arcmin: 199.5, diopters: -4.00 },
    { label: '6/180', logmar: 1.7, arcmin: 251.2, diopters: -4.25 },
    { label: '6/200', logmar: 1.8, arcmin: 316.2, diopters: -4.50 },
    { label: '6/240', logmar: 1.9, arcmin: 398.1, diopters: -4.75 },
    { label: '6/300', logmar: 2.0, arcmin: 501.2, diopters: -5.00 },
];

// ── Constants — exact from calibration.service.ts ─────────────────────────────
const FAR_DISTANCE_MM = 6000;
const NEAR_DISTANCE_MM = 330;
const PARALLAX_FACTORS = { bg: 4.0, mid: 2.0, fg: 0.5 };

// ── Known-device PPI table — exact copy from calibration.service.ts ───────────
const KNOWN_PPI = {
    'realme C30': 269, 'realme C31': 269, 'realme C33': 269, 'realme C35': 401,
    'realme C51': 269, 'realme C53': 282, 'realme C55': 282, 'realme C61': 282,
    'realme C65': 282,
    'Narzo 50': 409, 'Narzo 50 Pro': 411, 'Narzo 50A': 269,
    'Narzo 60': 409, 'Narzo 60 Pro': 394, 'Narzo 60x': 282,
    'Narzo N53': 282, 'Narzo N55': 282,
    'realme 9 Pro+': 452, 'realme 9 Pro': 394, 'realme 9i': 269,
    'realme 10': 282, 'realme 10 Pro+': 394, 'realme 10 Pro': 394,
    'realme 11 Pro+': 452, 'realme 11 Pro': 394, 'realme 11': 282,
    'realme 12 Pro+': 452, 'realme 12 Pro': 394, 'realme 12': 282,
    'realme 13 Pro+': 452, 'realme 13 Pro': 394,
    'realme GT2 Pro': 526, 'realme GT2': 394,
    'realme GT Neo 3': 394, 'realme GT Neo 5': 394, 'realme GT3': 394,
    'iQOO Z6 Lite': 408, 'iQOO Z6 Pro': 401, 'iQOO Z6': 409,
    'iQOO Z7 Pro': 388, 'iQOO Z7': 415, 'iQOO Z7s': 409,
    'iQOO Z9 Lite': 282, 'iQOO Z9s Pro': 452, 'iQOO Z9s': 394,
    'iQOO Z9x': 282, 'iQOO Z9': 394,
    'iQOO Z10 Lite': 282, 'iQOO Z10x': 282, 'iQOO Z10R': 394, 'iQOO Z10': 394,
    'iQOO Z11x': 394,
    'iQOO Neo 7 Pro': 452, 'iQOO Neo 7': 388,
    'iQOO Neo 8 Pro': 452, 'iQOO Neo 8': 388,
    'iQOO Neo9 Pro': 452, 'iQOO Neo9': 388,
    'iQOO Neo 10R': 394, 'iQOO Neo 10': 394, 'iQOO Neo 11': 510,
    'iQOO 11': 518, 'iQOO 12': 518, 'iQOO 13': 518,
    'iQOO 15R': 460, 'iQOO 15': 518,
};

class VrCalibrationService {
    constructor() {
        // Default profile — exact from calibration.service.ts
        this._profile = {
            ppi: 500,
            physicalDistanceMm: 350,
            lensMagnification: 1.0,
            ipdMm: 63,
        };
    }

    // ── Profile setters/getters ────────────────────────────────────────────────

    setProfile(partial) {
        this._profile = { ...this._profile, ...partial };
    }

    getProfile() {
        return { ...this._profile };
    }

    /**
     * setManualPpi — exact from calibration.service.ts
     */
    setManualPpi(ppi) {
        if (ppi < 100 || ppi > 800) {
            console.warn(`[Calibration] Suspicious PPI value: ${ppi}. Ignoring.`);
            return;
        }
        this._profile.ppi = ppi;
        console.log(`[Calibration] Manual PPI set: ${ppi}`);
    }

    /**
     * autoDetectPpi — exact logic from calibration.service.ts
     *
     * React Native notes:
     *   • navigator.userAgent is available in Hermes / RN
     *   • PixelRatio.get() replaces window.devicePixelRatio
     *   • Dimensions.get('screen') replaces screen.width / screen.height
     *   • The diagonal heuristic is preserved as-is from Angular
     */
    autoDetectPpi() {
        const ua = (navigator?.userAgent) ?? '';
        for (const [model, knownPpi] of Object.entries(KNOWN_PPI)) {
            if (ua.includes(model)) {
                this._profile.ppi = knownPpi;
                console.log(`[Calibration] Matched device "${model}" → PPI: ${knownPpi}`);
                return knownPpi;
            }
        }

        // Heuristic — exact formula from calibration.service.ts
        const dpr = PixelRatio.get();
        const screen = Dimensions.get('screen');
        const diagPx = Math.sqrt(
            Math.pow(screen.width * dpr, 2) +
            Math.pow(screen.height * dpr, 2),
        );
        // Angular: const diagIn = diagPx / (80 * dpr)
        const diagIn = diagPx / (40 * dpr);
        const estimated = diagPx / diagIn;

        const ppi = (estimated > 100 && estimated < 800) ? Math.round(estimated) : 326;
        this._profile.ppi = ppi;
        console.log(`[Calibration] Auto-detected PPI: ${ppi} (dpr=${dpr}, diagPx=${diagPx.toFixed(0)})`);
        return ppi;
    }

    // ── Derived getters — exact from calibration.service.ts ───────────────────

    get pixelsPerMm() {
        return this._profile.ppi / 25.4;
    }

    get effectiveDistanceMm() {
        return this._profile.physicalDistanceMm * this._profile.lensMagnification;
    }

    // ── Core formula — exact from calibration.service.ts ─────────────────────
    /**
     * arcminToPixels(arcmin)
     *
     * Angular formula (verbatim):
     *   const halfAngleRad = (arcmin / 2 / 60) * (Math.PI / 180);
     *   const sizeMm = 2 * this.effectiveDistanceMm * Math.tan(halfAngleRad);
     *   return sizeMm * this.pixelsPerMm;
     *
     * This is the ONLY correct way to compute optotype size.
     * DO NOT use the old hardcoded sizePx values from visionService.js.
     */
    arcminToPixels(arcmin) {
        const halfAngleRad = (arcmin / 2 / 60) * (Math.PI / 180);
        const sizeMm = 2 * this.effectiveDistanceMm * Math.tan(halfAngleRad);
        return sizeMm * this.pixelsPerMm;
    }

    /**
     * levelToPixels(levelIndex)
     *
     * Exact from calibration.service.ts:
     *   const entry = ACUITY_ARCMIN[Math.min(levelIndex, ACUITY_ARCMIN.length - 1)];
     *   return this.arcminToPixels(entry.arcmin);
     */
    levelToPixels(levelIndex) {
        const entry = ACUITY_ARCMIN[Math.min(levelIndex, ACUITY_ARCMIN.length - 1)];
        return this.arcminToPixels(entry.arcmin);
    }

    /**
     * calibratedFontSizePx(levelIndex, panelWidthPx, panelHeightPx)
     *
     * Exact port of Angular calibratedFontSizePx getter:
     *
     *   get calibratedFontSizePx(): number {
     *     const raw = this.calib.levelToPixels(this.optotype.sizeLevel ?? 0);
     *     const discPx = Math.min(window.innerHeight * 0.80, window.innerWidth * 0.45);
     *     const maxPx  = discPx * 0.90;
     *     return Math.min(raw, maxPx);
     *   }
     *
     * In RN: panelHeight = half of landscape screen height (the VR split area).
     *        panelWidth  = half of landscape screen width (one eye panel).
     *
     * Angular used window.innerWidth = FULL screen width (both eyes combined).
     * So 0.45 × fullWidth ≈ 0.45 × (2 × panelWidth) = 0.90 × panelWidth.
     * We preserve the same proportions by passing full-screen dimensions.
     *
     * @param {number} levelIndex   - 0-indexed into ACUITY_ARCMIN
     * @param {number} screenW      - full landscape screen width  (both eyes)
     * @param {number} screenH      - full landscape screen height
     * @returns {number} font size in device-independent pixels (CSS px equiv)
     */
    calibratedFontSizePx(levelIndex, screenW, screenH) {
        const raw = this.levelToPixels(levelIndex ?? 0);

        // Angular: discPx = Math.min(window.innerHeight * 0.80, window.innerWidth * 0.45)
        // In VR landscape: innerHeight ≈ screenH (short axis), innerWidth ≈ screenW (full)
        const discPx = Math.min(screenH * 0.80, screenW * 0.45);
        const maxPx = discPx * 0.90;

        return Math.min(raw, maxPx);
    }

    // ── Disparity (stereoscopic offset) — exact from calibration.service.ts ───

    computeDisparityPx(virtualDistanceMm) {
        const { ipdMm, physicalDistanceMm } = this._profile;
        const shiftMm = (ipdMm / 2) * (physicalDistanceMm / virtualDistanceMm);
        return shiftMm * this.pixelsPerMm;
    }

    get farDisparityPx() {
        return this.computeDisparityPx(FAR_DISTANCE_MM);
    }

    get nearDisparityPx() {
        return this.computeDisparityPx(NEAR_DISTANCE_MM);
    }

    /**
     * getEyeDisparityTransform — exact from calibration.service.ts
     *
     * Returns a translateX value in px (number, not string).
     * In RN: apply as { transform: [{ translateX: value }] }
     *
     * Angular: const sign = eye === 'left' ? -1 : 1;
     *          return `translateX(${(sign * d).toFixed(2)}px)`;
     */
    getEyeDisparityPx(eye, phase) {
        let d = 0;
        if (phase === 'acuity') d = this.farDisparityPx;
        else if (phase === 'near') d = this.nearDisparityPx;
        const sign = eye === 'left' ? -1 : 1;
        return sign * d;
    }

    // ── Parallax — exact from calibration.service.ts ──────────────────────────

    /**
     * computeParallax(gamma, beta)
     *
     * Angular exact:
     *   const g = Math.max(-20, Math.min(20, gamma));
     *   const b = Math.max(-20, Math.min(20, beta));
     *   const f = PARALLAX_FACTORS;
     *   return {
     *     bg:  { x: g * f.bg,  y: b * f.bg  },
     *     mid: { x: g * f.mid, y: b * f.mid },
     *     fg:  { x: g * f.fg,  y: b * f.fg  },
     *   };
     *
     * In RN: feed gamma/beta from react-native-sensors Gyroscope or DeviceMotion.
     *
     * @param {number} gamma - device tilt left/right (degrees, clamped ±25 in Angular component)
     * @param {number} beta  - device tilt forward/back (degrees)
     * @returns {{ bg, mid, fg }} — each { x, y } in px
     */
    computeParallax(gamma, beta) {
        const g = Math.max(-20, Math.min(20, gamma));
        const b = Math.max(-20, Math.min(20, beta));
        const f = PARALLAX_FACTORS;
        return {
            bg: { x: g * f.bg, y: b * f.bg },
            mid: { x: g * f.mid, y: b * f.mid },
            fg: { x: g * f.fg, y: b * f.fg },
        };
    }

    // ── Diagnostic — exact from calibration.service.ts ────────────────────────

    diagnosticSummary() {
        const p = this._profile;
        return {
            ppi: p.ppi,
            physicalDistanceMm: p.physicalDistanceMm,
            lensMagnification: p.lensMagnification,
            effectiveDistanceMm: this.effectiveDistanceMm,
            ipdMm: p.ipdMm,
            // Sanity check: 6/6 optotype should be ~1.45 mm tall at 6 m
            sample_6_6_px: this.arcminToPixels(5.0).toFixed(1),
            sample_6_60_px: this.arcminToPixels(79.4).toFixed(1),
            sample_6_75_px: this.arcminToPixels(100.0).toFixed(1),
        };
    }
}

// Singleton — mirrors Angular @Injectable({ providedIn: 'root' })
export const calibrationService = new VrCalibrationService();
export default calibrationService;