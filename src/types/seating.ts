export type TableTag = 'estandar' | 'vip' | 'familia' | 'honor';

export type StatusFilter = 'todas' | 'libres' | 'ocupadas' | 'sobrantes' | 'vip';

export type ActiveView = 'plano' | 'invitados' | 'resumen' | 'control';

export interface ControlPanelConfig {
  passwordHash: string;
  passwordSalt: string;
  reservationsLocked: boolean;
  editRequiresAdmin: boolean;
  eventNotice: string;
  updatedAt: number;
}

export interface TableAssignment {
  guestName: string;
  guestsCount: number;
  tag: TableTag;
  notes: string;
  updatedAt: number;
}

export type AssignmentsMap = Record<string, TableAssignment>;

export interface ToldoConfig {
  id: number;
  name: string;
  type: 'mesas' | 'pista';
  mesas?: number;
  personas?: number;
  subtitle?: string;
}

export interface TableSelection {
  tableId: string;
  toldoId: number;
  toldoName: string;
  tableNumber: number;
}

export const SEATS_PER_TABLE = 10;
export const DEFAULT_SEATS_PER_TABLE = SEATS_PER_TABLE;
export const MIN_SEATS_PER_TABLE = 1;
export const MAX_SEATS_PER_TABLE = SEATS_PER_TABLE;
export const MAX_GUEST_NAME_LENGTH = 120;
export const MAX_NOTES_LENGTH = 240;
export const MAX_EVENT_NOTICE_LENGTH = 180;
export const VALID_TABLE_ID_REGEX = /^toldo-(1|2|3|5|6|7|8)-mesa-([1-9]|1[0-5])$/;
export const VALID_TOLDO_IDS = new Set([1, 2, 3, 5, 6, 7, 8]);

export function getRemainingSeats(occupiedSeats: number): number {
  const clamped = Math.min(
    MAX_SEATS_PER_TABLE,
    Math.max(0, Math.round(occupiedSeats))
  );
  return SEATS_PER_TABLE - clamped;
}

export function formatRemainingSeats(remaining: number): string {
  if (remaining <= 0) return 'Mesa completa';
  if (remaining === 1) return 'Sobra 1 silla';
  return `Sobran ${remaining} sillas`;
}

export const TAG_LABELS: Record<TableTag, string> = {
  estandar: 'Estándar',
  vip: 'VIP',
  familia: 'Familia',
  honor: 'Mesa de Honor',
};

export const TOLDOS_CONFIG: ToldoConfig[] = [
  { id: 8, name: 'TOLDO 8', type: 'mesas', mesas: 15, personas: 150 },
  { id: 3, name: 'TOLDO 3', type: 'mesas', mesas: 15, personas: 150 },
  { id: 2, name: 'TOLDO 2', type: 'mesas', mesas: 15, personas: 150 },
  { id: 1, name: 'TOLDO 1', type: 'mesas', mesas: 15, personas: 150 },
  {
    id: 4,
    name: 'PISTA DE BAILE',
    type: 'pista',
    subtitle: 'Toldo 4 · Grupo musical',
  },
  { id: 5, name: 'TOLDO 5', type: 'mesas', mesas: 15, personas: 150 },
  { id: 6, name: 'TOLDO 6', type: 'mesas', mesas: 15, personas: 150 },
  { id: 7, name: 'TOLDO 7', type: 'mesas', mesas: 15, personas: 150 },
];

export const SEATING_TOLDOS = TOLDOS_CONFIG.filter((t) => t.type === 'mesas');

export const TOTAL_TABLES = SEATING_TOLDOS.reduce(
  (acc, t) => acc + (t.mesas ?? 0),
  0
);

export const TOTAL_CAPACITY = SEATING_TOLDOS.reduce(
  (acc, t) => acc + (t.personas ?? 0),
  0
);

export function buildTableId(toldoId: number, tableNumber: number): string {
  return `toldo-${toldoId}-mesa-${tableNumber}`;
}

export function parseTableId(
  tableId: string
): { toldoId: number; tableNumber: number } | null {
  const match = /^toldo-(\d+)-mesa-(\d+)$/.exec(tableId);
  if (!match) return null;
  return {
    toldoId: Number(match[1]),
    tableNumber: Number(match[2]),
  };
}
