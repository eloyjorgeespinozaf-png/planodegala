import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  OperationType,
  db,
  handleFirestoreError,
  isQuotaExceededError,
} from '../firebase';
import {
  AssignmentsMap,
  DEFAULT_SEATS_PER_TABLE,
  MAX_COMBINED_GUEST_NAME_LENGTH,
  MAX_GUEST_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_SEATS_PER_TABLE,
  MIN_SEATS_PER_TABLE,
  SEATING_TOLDOS,
  SEATS_PER_TABLE,
  TOTAL_CAPACITY,
  TOTAL_TABLES,
  TableAssignment,
  TableBooking,
  TableTag,
  VALID_TABLE_ID_REGEX,
  VALID_TOLDO_IDS,
  buildTableId,
  formatRemainingSeats,
  getRemainingSeats,
  getTableBookings,
  hasVipOrHonorBooking,
  parseTableId,
  summarizeBookings,
} from '../types/seating';

const LEGACY_STORAGE_KEY = 'plano_gala_mesas_v1';
const COLLECTION_NAME = 'tableReservations';
const VALID_TAGS: TableTag[] = ['estandar', 'vip', 'familia', 'honor'];

export interface ToastMessage {
  id: number;
  text: string;
  canUndo?: boolean;
}

export interface ToldoStats {
  toldoId: number;
  toldoName: string;
  totalTables: number;
  occupiedTables: number;
  freeTables: number;
  assignedGuests: number;
  spareSeatsInReserved: number;
  capacity: number;
  vipTables: number;
  occupancyRate: number;
}

interface UndoEntry {
  tableId: string;
  toldoId: number;
  tableNumber: number;
  guestName: string;
  guestsCount: number;
  tag: TableTag;
  notes: string;
  reservations: TableBooking[];
}

function sanitizeBooking(raw: unknown): TableBooking | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<TableBooking>;
  const guestName =
    typeof obj.guestName === 'string'
      ? obj.guestName.trim().slice(0, MAX_GUEST_NAME_LENGTH)
      : '';
  if (!guestName) return null;
  const rawCount = Number(obj.guestsCount);
  const guestsCount = Number.isFinite(rawCount)
    ? Math.min(
        MAX_SEATS_PER_TABLE,
        Math.max(MIN_SEATS_PER_TABLE, Math.round(rawCount))
      )
    : DEFAULT_SEATS_PER_TABLE;
  const tag: TableTag =
    typeof obj.tag === 'string' && VALID_TAGS.includes(obj.tag as TableTag)
      ? (obj.tag as TableTag)
      : 'estandar';
  const notes =
    typeof obj.notes === 'string'
      ? obj.notes.trim().slice(0, MAX_NOTES_LENGTH)
      : '';

  return { guestName, guestsCount, tag, notes };
}

function parseDocToAssignment(data: Record<string, unknown>): TableAssignment | null {
  let bookings: TableBooking[] = [];

  if (Array.isArray(data.reservations) && data.reservations.length > 0) {
    let runningSeats = 0;
    for (const item of data.reservations) {
      const clean = sanitizeBooking(item);
      if (!clean) continue;
      if (runningSeats + clean.guestsCount > MAX_SEATS_PER_TABLE) continue;
      bookings.push(clean);
      runningSeats += clean.guestsCount;
      if (bookings.length >= MAX_SEATS_PER_TABLE) break;
    }
  }

  if (bookings.length === 0) {
    const guestName =
      typeof data.guestName === 'string'
        ? data.guestName.trim().slice(0, MAX_GUEST_NAME_LENGTH)
        : '';
    if (!guestName) return null;
    const rawCount = Number(data.guestsCount);
    const guestsCount = Number.isFinite(rawCount)
      ? Math.min(
          MAX_SEATS_PER_TABLE,
          Math.max(MIN_SEATS_PER_TABLE, Math.round(rawCount))
        )
      : DEFAULT_SEATS_PER_TABLE;
    const tag: TableTag =
      typeof data.tag === 'string' && VALID_TAGS.includes(data.tag as TableTag)
        ? (data.tag as TableTag)
        : 'estandar';
    const notes =
      typeof data.notes === 'string'
        ? data.notes.trim().slice(0, MAX_NOTES_LENGTH)
        : '';
    bookings = [{ guestName, guestsCount, tag, notes }];
  }

  const summary = summarizeBookings(bookings);
  if (!summary.guestName || summary.guestsCount < 1) return null;

  return {
    guestName: summary.guestName,
    guestsCount: summary.guestsCount,
    tag: summary.tag,
    notes: summary.notes,
    reservations: summary.reservations,
    updatedAt: toMillis(data.updatedAt),
  };
}

function sanitizeLegacyLocalMap(raw: unknown): AssignmentsMap {
  if (!raw || typeof raw !== 'object') return {};
  const result: AssignmentsMap = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_TABLE_ID_REGEX.test(key)) continue;

    if (typeof value === 'string' && value.trim()) {
      const booking: TableBooking = {
        guestName: value.trim().slice(0, MAX_GUEST_NAME_LENGTH),
        guestsCount: DEFAULT_SEATS_PER_TABLE,
        tag: 'estandar',
        notes: '',
      };
      result[key] = {
        ...booking,
        reservations: [booking],
        updatedAt: Date.now(),
      };
      continue;
    }

    if (value && typeof value === 'object') {
      const parsed = parseDocToAssignment(value as Record<string, unknown>);
      if (parsed) {
        result[key] = parsed;
      }
    }
  }

  return result;
}

function loadLegacyLocalData(): AssignmentsMap {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return {};
    return sanitizeLegacyLocalMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return Date.now();
}

export function useSeatingStore() {
  const [assignments, setAssignments] = useState<AssignmentsMap>({});
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [legacyLocalMap, setLegacyLocalMap] = useState<AssignmentsMap>(() =>
    loadLegacyLocalData()
  );

  const undoEntriesRef = useRef<UndoEntry[] | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Surface fatal Firestore errors to React ErrorBoundary
  if (syncError) {
    throw syncError;
  }

  const showToast = useCallback((text: string, canUndo = false) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), text, canUndo });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      undoEntriesRef.current = null;
    }, 5500);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(null);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Attach real-time Firestore listener directly on mount (frictionless shared access)
  useEffect(() => {
    setLoading(true);
    const reservationsQuery = query(
      collection(db, COLLECTION_NAME),
      where('visibility', '==', 'shared')
    );

    const unsubscribe = onSnapshot(
      reservationsQuery,
      (snapshot) => {
        const nextMap: AssignmentsMap = {};
        snapshot.forEach((docSnap) => {
          const id = docSnap.id;
          if (!VALID_TABLE_ID_REGEX.test(id)) return;
          const parsed = parseDocToAssignment(
            docSnap.data() as Record<string, unknown>
          );
          if (!parsed) return;
          nextMap[id] = parsed;
        });

        setAssignments(nextMap);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
        } catch (wrappedError) {
          setSyncError(
            wrappedError instanceof Error
              ? wrappedError
              : new Error(String(wrappedError))
          );
        }
      }
    );

    return () => unsubscribe();
  }, []);

  /**
   * Reserves a free table OR atomically appends another family/person to an already
   * reserved table so its 10 seats can be completed without race conditions.
   */
  const addBookingToTable = useCallback(
    async (
      tableId: string,
      booking: TableBooking,
      label: string
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!VALID_TABLE_ID_REGEX.test(tableId)) {
        return { ok: false, error: 'Mesa inválida.' };
      }

      const parsed = parseTableId(tableId);
      if (
        !parsed ||
        !VALID_TOLDO_IDS.has(parsed.toldoId) ||
        parsed.tableNumber < 1 ||
        parsed.tableNumber > 15
      ) {
        return { ok: false, error: 'Ubicación inválida.' };
      }

      const cleanBooking = sanitizeBooking(booking);
      if (!cleanBooking) {
        return { ok: false, error: 'Ingresa un nombre válido.' };
      }

      const docPath = `${COLLECTION_NAME}/${tableId}`;
      const docRef = doc(db, COLLECTION_NAME, tableId);

      setSaving(true);
      try {
        let finalTotalSeats = cleanBooking.guestsCount;
        let wasSharedAddition = false;

        await runTransaction(db, async (tx) => {
          const snap = await tx.get(docRef);
          if (!snap.exists()) {
            const summary = summarizeBookings([cleanBooking]);
            finalTotalSeats = summary.guestsCount;
            tx.set(docRef, {
              tableId,
              toldoId: parsed.toldoId,
              tableNumber: parsed.tableNumber,
              guestName: summary.guestName,
              guestsCount: summary.guestsCount,
              tag: summary.tag,
              notes: summary.notes,
              reservations: summary.reservations,
              visibility: 'shared',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            return;
          }

          wasSharedAddition = true;
          const liveAssignment = parseDocToAssignment(
            snap.data() as Record<string, unknown>
          );
          const currentBookings = liveAssignment
            ? getTableBookings(liveAssignment)
            : [];
          const currentTotal = currentBookings.reduce(
            (sum, b) => sum + b.guestsCount,
            0
          );
          const available = SEATS_PER_TABLE - currentTotal;

          if (available <= 0) {
            throw new Error('TABLE_FULL');
          }
          if (cleanBooking.guestsCount > available) {
            throw new Error(`NOT_ENOUGH_SEATS:${available}`);
          }

          const nextBookings = [...currentBookings, cleanBooking];
          const summary = summarizeBookings(nextBookings);
          finalTotalSeats = summary.guestsCount;

          tx.update(docRef, {
            guestName: summary.guestName,
            guestsCount: summary.guestsCount,
            tag: summary.tag,
            notes: summary.notes,
            reservations: summary.reservations,
            updatedAt: serverTimestamp(),
          });
        });

        const remaining = getRemainingSeats(finalTotalSeats);
        undoEntriesRef.current = null;
        showToast(
          wasSharedAddition
            ? remaining === 0
              ? `${cleanBooking.guestName} completó ${label} (10/10 sillas)`
              : `${cleanBooking.guestName} (+${cleanBooking.guestsCount}) sumado a ${label} (${finalTotalSeats}/10 · ${formatRemainingSeats(
                  remaining
                ).toLowerCase()})`
            : `${label} reservada para ${cleanBooking.guestName} (${finalTotalSeats}/10 · ${formatRemainingSeats(
                remaining
              ).toLowerCase()})`
        );
        return { ok: true };
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'TABLE_FULL') {
            return {
              ok: false,
              error: 'Esta mesa ya fue completada (10/10 sillas).',
            };
          }
          if (error.message.startsWith('NOT_ENOUGH_SEATS:')) {
            const avail = Number(error.message.split(':')[1] ?? '0');
            return {
              ok: false,
              error:
                avail === 1
                  ? 'Solo queda 1 silla disponible en esta mesa.'
                  : `Solo quedan ${avail} sillas disponibles en esta mesa.`,
            };
          }
        }

        try {
          handleFirestoreError(error, OperationType.WRITE, docPath);
        } catch (wrappedError) {
          const msg =
            wrappedError instanceof Error
              ? wrappedError.message
              : String(wrappedError);
          if (isQuotaExceededError(msg)) {
            setSyncError(
              wrappedError instanceof Error ? wrappedError : new Error(msg)
            );
          } else {
            showToast(
              'No se pudo guardar la reserva. Verifica los datos e intenta de nuevo.'
            );
          }
        }
        return {
          ok: false,
          error: 'No se pudo guardar la reserva en Firestore.',
        };
      } finally {
        setSaving(false);
      }
    },
    [showToast]
  );

  /**
   * Updates one specific family/guest reservation inside a table (single or shared).
   */
  const updateBookingAtIndex = useCallback(
    async (
      tableId: string,
      bookingIndex: number,
      updatedBooking: TableBooking,
      label: string
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!VALID_TABLE_ID_REGEX.test(tableId)) {
        return { ok: false, error: 'Mesa inválida.' };
      }
      const existing = assignments[tableId];
      if (!existing) return { ok: false, error: 'La mesa no está reservada.' };

      const currentBookings = getTableBookings(existing);
      if (bookingIndex < 0 || bookingIndex >= currentBookings.length) {
        return { ok: false, error: 'Reserva no encontrada.' };
      }

      const clean = sanitizeBooking(updatedBooking);
      if (!clean) {
        return { ok: false, error: 'Ingresa un nombre válido.' };
      }

      const otherSeats = currentBookings.reduce(
        (sum, b, idx) => (idx === bookingIndex ? sum : sum + b.guestsCount),
        0
      );
      if (otherSeats + clean.guestsCount > SEATS_PER_TABLE) {
        const maxAllowed = SEATS_PER_TABLE - otherSeats;
        return {
          ok: false,
          error: `Máximo ${maxAllowed} ${
            maxAllowed === 1 ? 'silla disponible' : 'sillas disponibles'
          } para esta reserva.`,
        };
      }

      const nextBookings = currentBookings.map((b, idx) =>
        idx === bookingIndex ? clean : b
      );
      const summary = summarizeBookings(nextBookings);
      const docPath = `${COLLECTION_NAME}/${tableId}`;

      setSaving(true);
      try {
        await updateDoc(doc(db, COLLECTION_NAME, tableId), {
          guestName: summary.guestName,
          guestsCount: summary.guestsCount,
          tag: summary.tag,
          notes: summary.notes,
          reservations: summary.reservations,
          updatedAt: serverTimestamp(),
        });

        const remaining = getRemainingSeats(summary.guestsCount);
        undoEntriesRef.current = null;
        showToast(
          `${label} actualizada (${summary.guestsCount}/10 · ${formatRemainingSeats(
            remaining
          ).toLowerCase()})`
        );
        return { ok: true };
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.UPDATE, docPath);
        } catch (wrappedError) {
          const msg =
            wrappedError instanceof Error
              ? wrappedError.message
              : String(wrappedError);
          if (isQuotaExceededError(msg)) {
            setSyncError(
              wrappedError instanceof Error ? wrappedError : new Error(msg)
            );
          } else {
            showToast('No se pudo actualizar la reserva.');
          }
        }
        return { ok: false, error: 'No se pudo actualizar la reserva.' };
      } finally {
        setSaving(false);
      }
    },
    [assignments, showToast]
  );

  /**
   * Removes a single family/guest from a shared table (or frees the table if last).
   */
  const removeBookingAtIndex = useCallback(
    async (tableId: string, bookingIndex: number, label: string) => {
      const prev = assignments[tableId];
      if (!prev) return;
      const parsed = parseTableId(tableId);
      if (!parsed) return;

      const currentBookings = getTableBookings(prev);
      if (bookingIndex < 0 || bookingIndex >= currentBookings.length) return;

      const removed = currentBookings[bookingIndex];
      const remainingBookings = currentBookings.filter(
        (_, idx) => idx !== bookingIndex
      );

      const docPath = `${COLLECTION_NAME}/${tableId}`;
      setSaving(true);
      try {
        if (remainingBookings.length === 0) {
          await deleteDoc(doc(db, COLLECTION_NAME, tableId));
          undoEntriesRef.current = [
            {
              tableId,
              toldoId: parsed.toldoId,
              tableNumber: parsed.tableNumber,
              guestName: prev.guestName,
              guestsCount: prev.guestsCount,
              tag: prev.tag,
              notes: prev.notes,
              reservations: currentBookings,
            },
          ];
          showToast(`${label} liberada`, true);
        } else {
          const summary = summarizeBookings(remainingBookings);
          await updateDoc(doc(db, COLLECTION_NAME, tableId), {
            guestName: summary.guestName,
            guestsCount: summary.guestsCount,
            tag: summary.tag,
            notes: summary.notes,
            reservations: summary.reservations,
            updatedAt: serverTimestamp(),
          });
          undoEntriesRef.current = null;
          showToast(
            `Se quitó a ${removed.guestName} de ${label} (${summary.guestsCount}/10 sillas ocupadas)`
          );
        }
      } catch (error) {
        try {
          handleFirestoreError(
            error,
            remainingBookings.length === 0
              ? OperationType.DELETE
              : OperationType.UPDATE,
            docPath
          );
        } catch (wrappedError) {
          const msg =
            wrappedError instanceof Error
              ? wrappedError.message
              : String(wrappedError);
          if (isQuotaExceededError(msg)) {
            setSyncError(
              wrappedError instanceof Error ? wrappedError : new Error(msg)
            );
          } else {
            showToast('No se pudo quitar esta reserva. Intenta de nuevo.');
          }
        }
      } finally {
        setSaving(false);
      }
    },
    [assignments, showToast]
  );

  const freeTable = useCallback(
    async (tableId: string, label: string) => {
      const prev = assignments[tableId];
      if (!prev) return;
      const parsed = parseTableId(tableId);
      if (!parsed) return;

      const docPath = `${COLLECTION_NAME}/${tableId}`;
      setSaving(true);
      try {
        await deleteDoc(doc(db, COLLECTION_NAME, tableId));
        undoEntriesRef.current = [
          {
            tableId,
            toldoId: parsed.toldoId,
            tableNumber: parsed.tableNumber,
            guestName: prev.guestName,
            guestsCount: prev.guestsCount,
            tag: prev.tag,
            notes: prev.notes,
            reservations: getTableBookings(prev),
          },
        ];
        showToast(`${label} liberada`, true);
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.DELETE, docPath);
        } catch (wrappedError) {
          const msg =
            wrappedError instanceof Error
              ? wrappedError.message
              : String(wrappedError);
          if (isQuotaExceededError(msg)) {
            setSyncError(
              wrappedError instanceof Error ? wrappedError : new Error(msg)
            );
          } else {
            showToast('No se pudo liberar esta mesa. Intenta de nuevo.');
          }
        }
      } finally {
        setSaving(false);
      }
    },
    [assignments, showToast]
  );

  const clearAllAssignments = useCallback(async () => {
    const entries = Object.entries(assignments);
    if (entries.length === 0) return;

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const undoList: UndoEntry[] = [];

      for (const [tableId, entry] of entries) {
        const parsed = parseTableId(tableId);
        if (!parsed) continue;
        batch.delete(doc(db, COLLECTION_NAME, tableId));
        undoList.push({
          tableId,
          toldoId: parsed.toldoId,
          tableNumber: parsed.tableNumber,
          guestName: entry.guestName,
          guestsCount: entry.guestsCount,
          tag: entry.tag,
          notes: entry.notes,
          reservations: getTableBookings(entry),
        });
      }

      await batch.commit();
      undoEntriesRef.current = undoList;
      showToast('Se liberaron todas las mesas del salón', true);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.DELETE, COLLECTION_NAME);
      } catch (wrappedError) {
        setSyncError(
          wrappedError instanceof Error
            ? wrappedError
            : new Error(String(wrappedError))
        );
      }
    } finally {
      setSaving(false);
    }
  }, [assignments, showToast]);

  const undoLastRemoval = useCallback(async () => {
    if (!undoEntriesRef.current) return;
    const entriesToRestore = undoEntriesRef.current;
    undoEntriesRef.current = null;

    setSaving(true);
    try {
      const batch = writeBatch(db);
      for (const item of entriesToRestore) {
        if (assignments[item.tableId]) continue;
        const summary = summarizeBookings(item.reservations);
        batch.set(doc(db, COLLECTION_NAME, item.tableId), {
          tableId: item.tableId,
          toldoId: item.toldoId,
          tableNumber: item.tableNumber,
          guestName: summary.guestName.slice(0, MAX_COMBINED_GUEST_NAME_LENGTH),
          guestsCount: summary.guestsCount,
          tag: summary.tag,
          notes: summary.notes.slice(0, MAX_NOTES_LENGTH),
          reservations: summary.reservations,
          visibility: 'shared',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      showToast('Reserva restaurada en Firestore');
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
      } catch (wrappedError) {
        setSyncError(
          wrappedError instanceof Error
            ? wrappedError
            : new Error(String(wrappedError))
        );
      }
    } finally {
      setSaving(false);
    }
  }, [assignments, showToast]);

  // Local-to-cloud migration for reservations saved before Firebase was enabled
  const importableLocalEntries = useMemo(() => {
    return Object.entries(legacyLocalMap).filter(
      ([tableId]) => !assignments[tableId]
    );
  }, [assignments, legacyLocalMap]);

  const importLocalReservations = useCallback(async () => {
    if (importableLocalEntries.length === 0) return;

    setSaving(true);
    try {
      const batch = writeBatch(db);
      let importedCount = 0;

      for (const [tableId, entry] of importableLocalEntries) {
        const parsed = parseTableId(tableId);
        if (!parsed || !VALID_TOLDO_IDS.has(parsed.toldoId)) continue;
        const summary = summarizeBookings(getTableBookings(entry));
        batch.set(doc(db, COLLECTION_NAME, tableId), {
          tableId,
          toldoId: parsed.toldoId,
          tableNumber: parsed.tableNumber,
          guestName: summary.guestName,
          guestsCount: summary.guestsCount,
          tag: summary.tag,
          notes: summary.notes,
          reservations: summary.reservations,
          visibility: 'shared',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        importedCount += 1;
      }

      if (importedCount > 0) {
        await batch.commit();
      }
      try {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        // Ignore storage cleanup errors
      }
      setLegacyLocalMap({});
      showToast(
        importedCount === 1
          ? 'Se subió 1 reserva local a Firestore'
          : `Se subieron ${importedCount} reservas locales a Firestore`
      );
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
      } catch (wrappedError) {
        setSyncError(
          wrappedError instanceof Error
            ? wrappedError
            : new Error(String(wrappedError))
        );
      }
    } finally {
      setSaving(false);
    }
  }, [importableLocalEntries, showToast]);

  const moveOrSwapTable = useCallback(
    async (sourceTableId: string, targetTableId: string): Promise<boolean> => {
      if (sourceTableId === targetTableId) return false;
      if (
        !VALID_TABLE_ID_REGEX.test(sourceTableId) ||
        !VALID_TABLE_ID_REGEX.test(targetTableId)
      ) {
        return false;
      }

      const sourceEntry = assignments[sourceTableId];
      if (!sourceEntry) return false;

      const targetParsed = parseTableId(targetTableId);
      if (
        !targetParsed ||
        !VALID_TOLDO_IDS.has(targetParsed.toldoId) ||
        targetParsed.tableNumber < 1 ||
        targetParsed.tableNumber > 15
      ) {
        return false;
      }

      const targetEntry = assignments[targetTableId];
      const sourceRef = doc(db, COLLECTION_NAME, sourceTableId);
      const targetRef = doc(db, COLLECTION_NAME, targetTableId);
      const sourceSummary = summarizeBookings(getTableBookings(sourceEntry));

      setSaving(true);
      try {
        const batch = writeBatch(db);
        if (targetEntry) {
          const targetSummary = summarizeBookings(getTableBookings(targetEntry));
          // Atomic swap between two occupied tables (preserving all co-reservations)
          batch.update(sourceRef, {
            guestName: targetSummary.guestName,
            guestsCount: targetSummary.guestsCount,
            tag: targetSummary.tag,
            notes: targetSummary.notes,
            reservations: targetSummary.reservations,
            updatedAt: serverTimestamp(),
          });
          batch.update(targetRef, {
            guestName: sourceSummary.guestName,
            guestsCount: sourceSummary.guestsCount,
            tag: sourceSummary.tag,
            notes: sourceSummary.notes,
            reservations: sourceSummary.reservations,
            updatedAt: serverTimestamp(),
          });
        } else {
          // Move reservation (including all co-reservations) to a free table
          batch.delete(sourceRef);
          batch.set(targetRef, {
            tableId: targetTableId,
            toldoId: targetParsed.toldoId,
            tableNumber: targetParsed.tableNumber,
            guestName: sourceSummary.guestName,
            guestsCount: sourceSummary.guestsCount,
            tag: sourceSummary.tag,
            notes: sourceSummary.notes,
            reservations: sourceSummary.reservations,
            visibility: 'shared',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        undoEntriesRef.current = null;
        showToast(
          targetEntry
            ? `Se intercambiaron las reservas entre Toldo ${parseTableId(sourceTableId)?.toldoId} M${parseTableId(sourceTableId)?.tableNumber} y Toldo ${targetParsed.toldoId} M${targetParsed.tableNumber}`
            : `${sourceEntry.guestName} trasladado a Toldo ${targetParsed.toldoId} · Mesa ${targetParsed.tableNumber}`
        );
        return true;
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
        } catch (wrappedError) {
          const msg =
            wrappedError instanceof Error
              ? wrappedError.message
              : String(wrappedError);
          if (isQuotaExceededError(msg)) {
            setSyncError(
              wrappedError instanceof Error ? wrappedError : new Error(msg)
            );
          } else {
            showToast('No se pudo mover la reserva. Intenta de nuevo.');
          }
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [assignments, showToast]
  );

  const clearToldoAssignments = useCallback(
    async (toldoId: number, toldoName: string) => {
      if (!VALID_TOLDO_IDS.has(toldoId)) return;

      const entries = Object.entries(assignments).filter(([tableId]) => {
        const parsed = parseTableId(tableId);
        return parsed?.toldoId === toldoId;
      });
      if (entries.length === 0) return;

      setSaving(true);
      try {
        const batch = writeBatch(db);
        const undoList: UndoEntry[] = [];

        for (const [tableId, entry] of entries) {
          const parsed = parseTableId(tableId);
          if (!parsed) continue;
          batch.delete(doc(db, COLLECTION_NAME, tableId));
          undoList.push({
            tableId,
            toldoId: parsed.toldoId,
            tableNumber: parsed.tableNumber,
            guestName: entry.guestName,
            guestsCount: entry.guestsCount,
            tag: entry.tag,
            notes: entry.notes,
            reservations: getTableBookings(entry),
          });
        }

        await batch.commit();
        undoEntriesRef.current = undoList;
        showToast(
          `Se liberaron ${undoList.length} ${
            undoList.length === 1 ? 'mesa' : 'mesas'
          } de ${toldoName}`,
          true
        );
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.DELETE, COLLECTION_NAME);
        } catch (wrappedError) {
          setSyncError(
            wrappedError instanceof Error
              ? wrappedError
              : new Error(String(wrappedError))
          );
        }
      } finally {
        setSaving(false);
      }
    },
    [assignments, showToast]
  );

  const importBackupJson = useCallback(
    async (raw: unknown): Promise<{ ok: boolean; count: number; error?: string }> => {
      const sourceObj =
        raw &&
        typeof raw === 'object' &&
        'assignments' in raw &&
        (raw as { assignments?: unknown }).assignments &&
        typeof (raw as { assignments?: unknown }).assignments === 'object'
          ? (raw as { assignments: unknown }).assignments
          : raw;

      const sanitized = sanitizeLegacyLocalMap(sourceObj);
      const entries = Object.entries(sanitized);
      if (entries.length === 0) {
        return {
          ok: false,
          count: 0,
          error: 'El archivo no contiene reservas válidas para importar.',
        };
      }

      setSaving(true);
      try {
        const batch = writeBatch(db);
        for (const [tableId, entry] of entries) {
          const parsed = parseTableId(tableId);
          if (!parsed || !VALID_TOLDO_IDS.has(parsed.toldoId)) continue;
          const docRef = doc(db, COLLECTION_NAME, tableId);
          const summary = summarizeBookings(getTableBookings(entry));
          if (assignments[tableId]) {
            batch.update(docRef, {
              guestName: summary.guestName,
              guestsCount: summary.guestsCount,
              tag: summary.tag,
              notes: summary.notes,
              reservations: summary.reservations,
              updatedAt: serverTimestamp(),
            });
          } else {
            batch.set(docRef, {
              tableId,
              toldoId: parsed.toldoId,
              tableNumber: parsed.tableNumber,
              guestName: summary.guestName,
              guestsCount: summary.guestsCount,
              tag: summary.tag,
              notes: summary.notes,
              reservations: summary.reservations,
              visibility: 'shared',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        await batch.commit();
        undoEntriesRef.current = null;
        showToast(
          entries.length === 1
            ? 'Se restauró 1 reserva desde el respaldo'
            : `Se restauraron ${entries.length} reservas desde el respaldo`
        );
        return { ok: true, count: entries.length };
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
        } catch (wrappedError) {
          const msg =
            wrappedError instanceof Error
              ? wrappedError.message
              : String(wrappedError);
          if (isQuotaExceededError(msg)) {
            setSyncError(
              wrappedError instanceof Error ? wrappedError : new Error(msg)
            );
          }
          return {
            ok: false,
            count: 0,
            error: 'No se pudo importar el respaldo en Firestore.',
          };
        }
      } finally {
        setSaving(false);
      }
    },
    [assignments, showToast]
  );

  const toldoStats = useMemo<ToldoStats[]>(() => {
    return SEATING_TOLDOS.map((toldo) => {
      const total = toldo.mesas ?? 15;
      const capacity = toldo.personas ?? 150;
      let occupiedTables = 0;
      let assignedGuests = 0;
      let spareSeatsInReserved = 0;
      let vipTables = 0;

      for (let i = 1; i <= total; i++) {
        const entry = assignments[buildTableId(toldo.id, i)];
        if (entry) {
          occupiedTables += 1;
          assignedGuests += entry.guestsCount;
          spareSeatsInReserved += getRemainingSeats(entry.guestsCount);
          if (hasVipOrHonorBooking(entry)) {
            vipTables += 1;
          }
        }
      }

      return {
        toldoId: toldo.id,
        toldoName: toldo.name,
        totalTables: total,
        occupiedTables,
        freeTables: total - occupiedTables,
        assignedGuests,
        spareSeatsInReserved,
        capacity,
        vipTables,
        occupancyRate:
          total > 0 ? Math.round((occupiedTables / total) * 100) : 0,
      };
    });
  }, [assignments]);

  const totals = useMemo(() => {
    let occupiedTables = 0;
    let assignedGuests = 0;
    let spareSeatsInReserved = 0;
    let vipTables = 0;

    for (const stat of toldoStats) {
      occupiedTables += stat.occupiedTables;
      assignedGuests += stat.assignedGuests;
      spareSeatsInReserved += stat.spareSeatsInReserved;
      vipTables += stat.vipTables;
    }

    return {
      totalTables: TOTAL_TABLES,
      occupiedTables,
      freeTables: TOTAL_TABLES - occupiedTables,
      assignedGuests,
      spareSeatsInReserved,
      totalCapacity: TOTAL_CAPACITY,
      vipTables,
      occupancyRate:
        TOTAL_TABLES > 0 ? Math.round((occupiedTables / TOTAL_TABLES) * 100) : 0,
    };
  }, [toldoStats]);

  return {
    assignments,
    toldoStats,
    totals,
    loading,
    saving,
    toast,
    importableLocalCount: importableLocalEntries.length,
    showToast,
    dismissToast,
    addBookingToTable,
    updateBookingAtIndex,
    removeBookingAtIndex,
    freeTable,
    clearAllAssignments,
    clearToldoAssignments,
    moveOrSwapTable,
    importBackupJson,
    undoLastRemoval,
    importLocalReservations,
  };
}
