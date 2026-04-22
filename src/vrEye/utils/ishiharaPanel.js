/**
 * ishiharaPanel.js
 * Converted from Angular ishiara-panel.ts
 * Pure utility — generates Ishihara colour-plate dot data.
 * No React/RN dependencies.
 *
 * Usage:
 *   import { getPlate, generatePlateDots, TOTAL_PLATES } from '../utils/ishiharaPanel';
 *   const plate  = getPlate(0);
 *   const dots   = generatePlateDots(plate);
 *   // dots: Array<{ cx, cy, r, fill }>
 */

// ── Seeded PRNG (Mulberry32) ──────────────────────────────────────────────────
function makePrng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Digit bitmaps (10×13 grid) ────────────────────────────────────────────────
const GLYPHS = {
  '0': [
    '0011111100',  // top arc (6px)
    '0111111110',  // arc widens (8px)
    '1110000111',  // 3px walls each side, 4px center gap
    '1110000111',
    '1110000111',
    '1110000111',
    '1110000111',
    '1110000111',
    '1110000111',
    '1110000111',
    '0111111110',  // bottom arc
    '0011111100',
    '0000000000',
  ],

  '1': [
    '0001111000',  // stem top — 4px (cols 3-6)
    '0011111000',  // left serif flag
    '0111111000',  // wider serif
    '0001111000',  // stem
    '0001111000',
    '0001111000',
    '0001111000',
    '0001111000',
    '0001111000',
    '0001111000',
    '0001111000',
    '0111111110',  // base (cols 1-8)
    '0111111110',
  ],

  '2': [
    '0011111100',  // top arc
    '0111111110',  // arc widens
    '1111111110',  // arc closes fully — both sides visible
    '0000011110',  // arc curls left; right wall 4px (cols 5-8)
    '0000111100',  // diagonal body — 4px wide, shifts 1 col left per row
    '0001111000',
    '0011110000',
    '0111100000',
    '1111000000',  // reaches left edge
    '1111000000',
    '1111000000',
    '1111111110',  // base
    '1111111110',
  ],

  '3': [
    '0011111100',  // top arc
    '0111111110',  // arc widens — left side OPEN
    '0000001110',  // right wall — 3px (cols 6,7,8) — thinner for cleaner look
    '0000001110',
    '0001111110',  // middle bar (cols 3-8, 6px)
    '0001111110',
    '0000001110',  // right wall — 3px resumes
    '0000001110',
    '0000001110',
    '1100001110',  // left 2px (cols 0,1) + 4px gap + right 3px — gap wide enough to never bridge
    '0111111110',  // bottom arc
    '0011111100',  // bottom tip
    '0000000000',
  ],

  '4': [
    // Left arm (cols 0-2, 3px) + right stem (cols 7-9, 3px) + 2-row crossbar
    '1110000111',
    '1110000111',
    '1110000111',
    '1110000111',
    '1111111111',  // crossbar — full 10px
    '1111111111',
    '0000000111',  // stem only below crossbar (cols 7-9)
    '0000000111',
    '0000000111',
    '0000000111',
    '0000000111',
    '0000000111',
    '0000001111',  // base slightly wider (cols 6-9)
  ],

  '5': [
    '1111111111',  // FULL 10px top bar — unmistakably flat, completely different from any arc
    '1110000000',  // left arm 3px — right side empty (shows the open right of top section)
    '1110000000',
    '1110000000',
    '1111111110',  // middle bar
    '0000001110',  // bowl top: RIGHT WALL ONLY (cols 6-8) — bowl entry is open on left
    '0000001110',  // right wall only — key visual difference from 6 which closes both sides
    '1110001110',  // left wall joins — bowl closes (cols 0-2 and cols 6-8)
    '1110001110',
    '1110001110',
    '1110001110',
    '0111111110',  // bottom arc
    '0000000000',
  ],

  '6': [
    '0001111100',  // narrow arc (5px: cols 3-7) — clearly NOT a flat bar
    '0011111110',  // arc widens
    '0111110000',  // arc sweeps LEFT — right side disappears (cols 1-5)
    '1110000000',  // left arm 3px
    '1111111110',  // junction bar
    '1110000111',  // bowl sides — BOTH sides from start (unlike 5 which opens right-only)
    '1110000111',
    '1110000111',
    '1110000111',
    '1110000111',
    '0111111110',  // bottom arc
    '0011111100',  // bottom tip
    '0000000000',
  ],

  '7': [
    '1111111110',  // top bar — 2px thick for visual weight
    '1111111110',
    '0000001110',  // diagonal 3px (cols 6-8), shifts 1 col left per row
    '0000011100',
    '0000111000',
    '0001110000',
    '0011100000',
    '0111000000',
    '1110000000',  // reaches left edge
    '1110000000',  // 3-row tail for clear endpoint
    '1110000000',
    '0000000000',
    '0000000000',
  ],

  '8': [
    // Balanced loops: 4 rows each, 3px walls, top + bottom arcs
    '0011111100',  // top arc
    '0111111110',
    '1110000111',  // upper loop — 4 rows
    '1110000111',
    '1110000111',
    '1110000111',
    '0111111110',  // middle junction
    '1110000111',  // lower loop — 4 rows (equal to upper = balanced)
    '1110000111',
    '1110000111',
    '1110000111',
    '0111111110',
    '0011111100',  // bottom arc
  ],

  '9': [
    '0011111100',  // top arc
    '0111111110',
    '1110000111',  // loop sides — 3px walls
    '1110000111',
    '1110000111',
    '1110000111',
    '0111111111',  // loop closes — right wall extends to col 9
    '0000001110',  // tail — 3px (cols 6-8)
    '0000011100',  // diagonal shifts 1 col left per row
    '0000111000',
    '0001110000',
    '0011100000',
    '0111000000',
  ],
};

// ── Figure hit-test ───────────────────────────────────────────────────────────
function isInFigure(dotX, dotY, digits) {
  const GW = 10, GH = 13, GAP = 5;
  const n = digits.length;
  const totalCols = n * GW + (n - 1) * GAP;
  const maxW = n === 1 ? 100 : 155; 
  const maxH = 110;
  const scale = Math.min(maxW / totalCols, maxH / GH);
  const totalW = totalCols * scale;
  const totalH = GH * scale;
  const originX = 100 - totalW / 2;
  const originY = 100 - totalH / 2;

  for (let d = 0; d < n; d++) {
    const glyph = GLYPHS[digits[d]];
    if (!glyph) continue;
    const gx = originX + d * (GW + GAP) * scale;
    const relX = (dotX - gx) / scale;
    const relY = (dotY - originY) / scale;
    if (relX >= 0 && relX < GW && relY >= 0 && relY < GH) {
      const col = Math.floor(relX);
      const row = Math.floor(relY);
      if (glyph[row]?.[col] === '1') return true;
    }
  }
  return false;
}

// ── Plate definitions ─────────────────────────────────────────────────────────
export const ISHIHARA_PLATES = [
  {
    plateNum: 1, digits: '12', altDigits: '12', seed: 42,
    figureHues: ['#e07030', '#d06020', '#c85010', '#e88040', '#f09050'],
    groundHues: ['#808080', '#909090', '#707070', '#a0a0a0', '#686868', '#b0b0b0']
  },
  {
    plateNum: 2, digits: '8', altDigits: '3', seed: 137,
    figureHues: ['#cc5555', '#dd6666', '#bb4444', '#e07070', '#cc4466'],
    groundHues: ['#aabb44', '#99aa33', '#bbcc55', '#88aa22', '#ccdd66', '#778833']
  },
  {
    plateNum: 3, digits: '6', altDigits: '5', seed: 251,
    figureHues: ['#cc5555', '#dd7777', '#bb3333', '#ee6666', '#cc4455'],
    groundHues: ['#aabb44', '#99aa33', '#bbcc55', '#88aa22', '#ccdd66', '#667722']
  },
  {
    plateNum: 4, digits: '29', altDigits: '70', seed: 333,
    figureHues: ['#667733', '#778844', '#556622', '#889955', '#6b8030'],
    groundHues: ['#dd8833', '#cc7722', '#ee9944', '#dd7711', '#c06020', '#e8a050']
  },
  {
    plateNum: 5, digits: '57', altDigits: '35', seed: 567,
    figureHues: ['#667733', '#778844', '#556622', '#889955', '#5a7228'],
    groundHues: ['#dd8833', '#cc7722', '#ee9944', '#dd7711', '#e09040']
  },
  {
    plateNum: 6, digits: '5', altDigits: '2', seed: 789,
    figureHues: ['#667733', '#778844', '#556622', '#889955'],
    groundHues: ['#dd8833', '#cc7722', '#ee9944', '#c06020']
  },
  {
    plateNum: 7, digits: '3', altDigits: '5', seed: 1001,
    figureHues: ['#667733', '#778844', '#556622', '#6b8030'],
    groundHues: ['#dd8833', '#cc7722', '#ee9944', '#e09040']
  },
  {
    plateNum: 8, digits: '15', altDigits: '17', seed: 1234,
    figureHues: ['#dd8833', '#cc7722', '#ee9944', '#f0a055'],
    groundHues: ['#aabb55', '#778833', '#99aa44', '#bbcc66', '#667722']
  },
  {
    plateNum: 9, digits: '74', altDigits: '21', seed: 1567,
    figureHues: ['#e07030', '#d06020', '#c85010', '#e88040'],
    groundHues: ['#aabb44', '#99aa33', '#bbcc55', '#ccdd66', '#889922']
  },
  {
    plateNum: 10, digits: '2', altDigits: '', seed: 1890,
    figureHues: ['#e07030', '#d06020', '#c85010', '#e88040'],
    groundHues: ['#aabb44', '#99aa33', '#bbcc55', '#ccdd66', '#778833']
  },
  {
    plateNum: 11, digits: '6', altDigits: '', seed: 2100,
    figureHues: ['#e07030', '#d06020', '#e88040', '#f09050'],
    groundHues: ['#aabb44', '#99aa33', '#bbcc55', '#ccdd66']
  },
  {
    plateNum: 12, digits: '5', altDigits: '5', seed: 2400,
    figureHues: ['#aabb44', '#99aa33', '#bbcc55'],
    groundHues: ['#dd8833', '#cc7722', '#ee9944']
  },
];

export const TOTAL_PLATES = ISHIHARA_PLATES.length;

// ── Dot generation ────────────────────────────────────────────────────────────
/**
 * Generate packed dot layout for an Ishihara plate.
 * @param {object} plate - IshiharaPlateConfig
 * @returns {Array<{ cx: number, cy: number, r: number, fill: string }>}
 */
export function generatePlateDots(plate) {
  const rng = makePrng(plate.seed);
  const CX = 100, CY = 100, R = 92;
  const dots = [];
  const CELL = 40;
  const hash = new Map();

  const hashKey = (gx, gy) => `${gx},${gy}`;
  const hashCell = (v) => Math.floor(v / CELL);

  function addToHash(dot) {
    const key = hashKey(hashCell(dot.cx), hashCell(dot.cy));
    if (!hash.has(key)) hash.set(key, []);
    hash.get(key).push(dot);
  }

  function overlaps(cx, cy, r) {
    const gx = hashCell(cx);
    const gy = hashCell(cy);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const neighbours = hash.get(hashKey(gx + dx, gy + dy));
        if (!neighbours) continue;
        for (const d of neighbours) {
          if (Math.hypot(cx - d.cx, cy - d.cy) < r + d.r + 0.5) return true;
        }
      }
    }
    return false;
  }

  // const MAX_ATTEMPTS = 22000;
  // for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
  //   const angle = rng() * Math.PI * 2;
  //   const dist = Math.sqrt(rng()) * R;
  //   const cx = CX + Math.cos(angle) * dist;
  //   const cy = CY + Math.sin(angle) * dist;
  //   const r = 2 + rng() * 3.5; // r ∈ [2, 5.5]

  //   if (Math.hypot(cx - CX, cy - CY) + r > R - 1) continue;
  //   if (overlaps(cx, cy, r)) continue;

  //   const inFig = isInFigure(cx, cy, plate.digits);
  //   const palette = inFig ? plate.figureHues : plate.groundHues;
  //   const fill = palette[Math.floor(rng() * palette.length)];

  //   const dot = { cx, cy, r, fill };
  //   dots.push(dot);
  //   addToHash(dot);
  // }
  function tryPlace(targetInFig, attempts) {
    for (let i = 0; i < attempts; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = Math.sqrt(rng()) * R;
      const cx = CX + Math.cos(angle) * dist;
      const cy = CY + Math.sin(angle) * dist;
      const r = 2 + rng() * 3.5;

      if (Math.hypot(cx - CX, cy - CY) + r > R - 1) continue;

      const inFig = isInFigure(cx, cy, plate.digits);
      if (inFig !== targetInFig) continue;

      if (overlaps(cx, cy, r)) continue;

      const palette = inFig ? plate.figureHues : plate.groundHues;
      const fill = palette[Math.floor(rng() * palette.length)];

      const dot = { cx, cy, r, fill };
      dots.push(dot);
      addToHash(dot);
    }
  }

  tryPlace(true, 18000);
  tryPlace(false, 18000);


  return dots;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function getPlate(index) {
  return ISHIHARA_PLATES[
    ((index % ISHIHARA_PLATES.length) + ISHIHARA_PLATES.length) % ISHIHARA_PLATES.length
  ];
}
