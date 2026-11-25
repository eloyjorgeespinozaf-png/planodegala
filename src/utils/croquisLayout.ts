import { SEATS_PER_TABLE, toReservationUpper } from '../types/seating';

export type TableShape = 'round' | 'rect';

export interface ToldoBand {
  toldoId: number;
  toldoName: string;
  topPct: number;
  heightPct: number;
}

export interface TableLayoutSlot {
  tableNumber: number;
  shape: TableShape;
  xPct: number;
  yOffsetRatio: number;
}

/**
 * Exact vertical canopy bands measured from the remastered 1200x896 HD croquis.
 * Toldo 4 (51.8% – 63.3%) is the Dance Floor / Stage band.
 */
export const TOLDO_BANDS: ToldoBand[] = [
  { toldoId: 8, toldoName: 'TOLDO 8', topPct: 4.1, heightPct: 11.9 },
  { toldoId: 3, toldoName: 'TOLDO 3', topPct: 16.0, heightPct: 11.9 },
  { toldoId: 2, toldoName: 'TOLDO 2', topPct: 27.9, heightPct: 11.9 },
  { toldoId: 1, toldoName: 'TOLDO 1', topPct: 39.8, heightPct: 11.8 },
  { toldoId: 5, toldoName: 'TOLDO 5', topPct: 63.4, heightPct: 11.5 },
  { toldoId: 6, toldoName: 'TOLDO 6', topPct: 74.9, heightPct: 11.3 },
  { toldoId: 7, toldoName: 'TOLDO 7', topPct: 86.2, heightPct: 11.4 },
];

/**
 * Exact 15-table architectural placement per Toldo matching the alternating
 * round & rectangular banquet tables drawn inside the HD croquis:
 * - Top row (M1..M7): Round, Rect, Round, Rect, Round, Rect, Round
 * - Bottom row (M8..M14): Rect, Round, Rect, Round, Rect, Round, Rect
 * - Right wing (M15): Round table in the clean right aisle between plants
 */
export const TABLE_SLOTS: TableLayoutSlot[] = [
  // Top row (7 alternating tables)
  { tableNumber: 1, shape: 'round', xPct: 23.7, yOffsetRatio: 0.29 },
  { tableNumber: 2, shape: 'rect', xPct: 33.4, yOffsetRatio: 0.29 },
  { tableNumber: 3, shape: 'round', xPct: 42.6, yOffsetRatio: 0.29 },
  { tableNumber: 4, shape: 'rect', xPct: 51.9, yOffsetRatio: 0.29 },
  { tableNumber: 5, shape: 'round', xPct: 60.9, yOffsetRatio: 0.29 },
  { tableNumber: 6, shape: 'rect', xPct: 70.1, yOffsetRatio: 0.29 },
  { tableNumber: 7, shape: 'round', xPct: 79.3, yOffsetRatio: 0.29 },
  // Bottom row (7 alternating tables)
  { tableNumber: 8, shape: 'rect', xPct: 26.3, yOffsetRatio: 0.75 },
  { tableNumber: 9, shape: 'round', xPct: 34.8, yOffsetRatio: 0.75 },
  { tableNumber: 10, shape: 'rect', xPct: 43.3, yOffsetRatio: 0.75 },
  { tableNumber: 11, shape: 'round', xPct: 52.0, yOffsetRatio: 0.75 },
  { tableNumber: 12, shape: 'rect', xPct: 60.5, yOffsetRatio: 0.75 },
  { tableNumber: 13, shape: 'round', xPct: 69.0, yOffsetRatio: 0.75 },
  { tableNumber: 14, shape: 'rect', xPct: 77.5, yOffsetRatio: 0.75 },
  // Table 15 (clean right-wing round table inside the hall wall)
  { tableNumber: 15, shape: 'round', xPct: 83.9, yOffsetRatio: 0.52 },
];

export const ROUND_CHAIRS = Array.from({ length: SEATS_PER_TABLE }, (_, idx) => {
  const angleDeg = idx * 36 - 90;
  const rad = (angleDeg * Math.PI) / 180;
  return {
    chairNum: idx + 1,
    cx: Number((40 + 31 * Math.cos(rad)).toFixed(1)),
    cy: Number((40 + 31 * Math.sin(rad)).toFixed(1)),
    rot: angleDeg + 90,
  };
});

export const RECT_CHAIRS: {
  chairNum: number;
  x: number;
  y: number;
  w: number;
  h: number;
}[] = [
  { chairNum: 1, x: 20, y: 2, w: 12, h: 7 },
  { chairNum: 2, x: 38, y: 2, w: 12, h: 7 },
  { chairNum: 3, x: 56, y: 2, w: 12, h: 7 },
  { chairNum: 4, x: 74, y: 2, w: 12, h: 7 },
  { chairNum: 5, x: 96, y: 21, w: 7, h: 12 },
  { chairNum: 6, x: 74, y: 45, w: 12, h: 7 },
  { chairNum: 7, x: 56, y: 45, w: 12, h: 7 },
  { chairNum: 8, x: 38, y: 45, w: 12, h: 7 },
  { chairNum: 9, x: 20, y: 45, w: 12, h: 7 },
  { chairNum: 10, x: 3, y: 21, w: 7, h: 12 },
];

export function getShortTableLabel(name: string, maxLen = 11): string {
  const trimmed = toReservationUpper(name.trim());
  if (trimmed.length <= maxLen) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1 && parts[0] === 'FAMILIA' && parts[1]) {
    const candidate = `FAM. ${parts[1]}`;
    return candidate.length <= maxLen
      ? candidate
      : `${candidate.slice(0, maxLen - 1)}…`;
  }
  return `${trimmed.slice(0, maxLen - 1)}…`;
}
