export type TableTag = 'estandar' | 'vip' | 'familia' | 'honor';

export type StatusFilter = 'todas' | 'libres' | 'ocupadas' | 'sobrantes' | 'vip';

export type ActiveView = 'croquis' | 'invitados' | 'resumen' | 'control';

export interface ControlPanelConfig {
  passwordHash: string;
  passwordSalt: string;
  reservationsLocked: boolean;
  editRequiresAdmin: boolean;
  eventNotice: string;
  updatedAt: number;
}

export interface TableBooking {
  guestName: string;
  guestsCount: number;
  tag: TableTag;
  notes: string;
}

export interface TableAssignment {
  guestName: string;
  guestsCount: number;
  tag: TableTag;
  notes: string;
  reservations: TableBooking[];
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
export const MAX_COMBINED_GUEST_NAME_LENGTH = 200;
export const MAX_NOTES_LENGTH = 240;
export const MAX_EVENT_NOTICE_LENGTH = 180;
export const VALID_TABLE_ID_REGEX = /^toldo-(1|2|3|5|6|7|8)-mesa-([1-9]|1[0-5])$/;
export const VALID_TOLDO_IDS = new Set([1, 2, 3, 5, 6, 7, 8]);

const TAG_PRIORITY: Record<TableTag, number> = {
  honor: 4,
  vip: 3,
  familia: 2,
  estandar: 1,
};

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

export function toReservationUpper(value: string): string {
  return value.toLocaleUpperCase('es-ES');
}

export function getTableBookings(assignment?: TableAssignment): TableBooking[] {
  if (!assignment) return [];
  if (
    Array.isArray(assignment.reservations) &&
    assignment.reservations.length > 0
  ) {
    return assignment.reservations.map((b) => ({
      ...b,
      guestName: toReservationUpper(b.guestName),
      notes: toReservationUpper(b.notes),
    }));
  }
  return [
    {
      guestName: toReservationUpper(assignment.guestName),
      guestsCount: assignment.guestsCount,
      tag: assignment.tag,
      notes: toReservationUpper(assignment.notes),
    },
  ];
}

export function hasVipOrHonorBooking(assignment?: TableAssignment): boolean {
  if (!assignment) return false;
  if (assignment.tag === 'vip' || assignment.tag === 'honor') return true;
  return getTableBookings(assignment).some(
    (b) => b.tag === 'vip' || b.tag === 'honor'
  );
}

export function summarizeBookings(bookings: TableBooking[]): {
  guestName: string;
  guestsCount: number;
  tag: TableTag;
  notes: string;
  reservations: TableBooking[];
} {
  const cleaned = bookings
    .map((b) => ({
      guestName: toReservationUpper(b.guestName.trim()).slice(
        0,
        MAX_GUEST_NAME_LENGTH
      ),
      guestsCount: Math.min(
        MAX_SEATS_PER_TABLE,
        Math.max(MIN_SEATS_PER_TABLE, Math.round(b.guestsCount))
      ),
      tag: b.tag,
      notes: toReservationUpper(b.notes.trim()).slice(0, MAX_NOTES_LENGTH),
    }))
    .filter((b) => b.guestName.length > 0);

  const totalSeats = cleaned.reduce((sum, b) => sum + b.guestsCount, 0);
  const combinedName = toReservationUpper(
    cleaned.map((b) => b.guestName).join(' + ')
  ).slice(0, MAX_COMBINED_GUEST_NAME_LENGTH);

  let primaryTag: TableTag = 'estandar';
  for (const b of cleaned) {
    if (TAG_PRIORITY[b.tag] > TAG_PRIORITY[primaryTag]) {
      primaryTag = b.tag;
    }
  }

  const combinedNotes = toReservationUpper(
    cleaned.length === 1
      ? cleaned[0].notes
      : cleaned
          .filter((b) => b.notes.length > 0)
          .map((b) => `${b.guestName}: ${b.notes}`)
          .join(' | ')
  ).slice(0, MAX_NOTES_LENGTH);

  return {
    guestName: combinedName,
    guestsCount: totalSeats,
    tag: primaryTag,
    notes: combinedNotes,
    reservations: cleaned,
  };
}

export function formatSharedOccupantsSummary(
  assignment: TableAssignment
): string {
  const bookings = getTableBookings(assignment);
  if (bookings.length <= 1) return assignment.guestName;
  return bookings
    .map((b) => `${b.guestName} (${b.guestsCount})`)
    .join(' + ');
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
