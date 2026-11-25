import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
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
  MAX_GUEST_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_SEATS_PER_TABLE,
  MIN_SEATS_PER_TABLE,
  SEATING_TOLDOS,
  TOTAL_CAPACITY,
  TOTAL_TABLES,
  TableAssignment,
  TableTag,
  VALID_TABLE_ID_REGEX,
  VALID_TOLDO_IDS,
  buildTableId,
  formatRemainingSeats,
  getRemainingSeats,
  parseTableId,
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
}

function sanitizeLegacyLocalMap(raw: unknown): AssignmentsMap {
  if (!raw || typeof raw !== 'object') return {};
  const result: AssignmentsMap = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_TABLE_ID_REGEX.test(key)) continue;

    if (typeof value === 'string' && value.trim()) {
      result[key] = {
        guestName: value.trim().slice(0, MAX_GUEST_NAME_LENGTH),
        guestsCount: DEFAULT_SEATS_PER_TABLE,
        tag: 'estandar',
        notes: '',
        updatedAt: Date.now(),
      };
      continue;
    }

    if (value && typeof value === 'object') {
      const obj = value as Partial<TableAssignment>;
      const name =
        typeof obj.guestName === 'string'
          ? obj.guestName.trim().slice(0, MAX_GUEST_NAME_LENGTH)
          : '';
      if (!name) continue;
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

      result[key] = {
        guestName: name,
        guestsCount,
        tag,
        notes,
        updatedAt: Date.now(),
      };
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
          const data = docSnap.data();
          const id = docSnap.id;
          if (!VALID_TABLE_ID_REGEX.test(id)) return;
          const guestName =
            typeof data.guestName === 'string' ? data.guestName.trim() : '';
          if (!guestName) return;

          const rawCount = Number(data.guestsCount);
          const guestsCount = Number.isFinite(rawCount)
            ? Math.min(
                MAX_SEATS_PER_TABLE,
                Math.max(MIN_SEATS_PER_TABLE, Math.round(rawCount))
              )
            : DEFAULT_SEATS_PER_TABLE;
          const tag: TableTag =
            typeof data.tag === 'string' &&
            VALID_TAGS.includes(data.tag as TableTag)
              ? (data.tag as TableTag)
              : 'estandar';

          nextMap[id] = {
            guestName,
            guestsCount,
            tag,
            notes: typeof data.notes === 'string' ? data.notes : '',
            updatedAt: toMillis(data.updatedAt),
          };
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

  const saveAssignment = useCallback(
    async (
      tableId: string,
      data: {
        guestName: string;
        guestsCount: number;
        tag: TableTag;
        notes: string;
      },
      label: string
    ) => {
      if (!VALID_TABLE_ID_REGEX.test(tableId)) return;

      const parsed = parseTableId(tableId);
      if (
        !parsed ||
        !VALID_TOLDO_IDS.has(parsed.toldoId) ||
        parsed.tableNumber < 1 ||
        parsed.tableNumber > 15
      ) {
        return;
      }

      const cleanName = data.guestName.trim().slice(0, MAX_GUEST_NAME_LENGTH);
      if (!cleanName) return;

      const clampedCount = Math.min(
        MAX_SEATS_PER_TABLE,
        Math.max(MIN_SEATS_PER_TABLE, Math.round(data.guestsCount))
      );
      const safeTag: TableTag = VALID_TAGS.includes(data.tag)
        ? data.tag
        : 'estandar';
      const cleanNotes = data.notes.trim().slice(0, MAX_NOTES_LENGTH);

      const docPath = `${COLLECTION_NAME}/${tableId}`;
      const docRef = doc(db, COLLECTION_NAME, tableId);
      const alreadyExists = Boolean(assignments[tableId]);

      setSaving(true);
      try {
        if (alreadyExists) {
          await updateDoc(docRef, {
            guestName: cleanName,
            guestsCount: clampedCount,
            tag: safeTag,
            notes: cleanNotes,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(docRef, {
            tableId,
            toldoId: parsed.toldoId,
            tableNumber: parsed.tableNumber,
            guestName: cleanName,
            guestsCount: clampedCount,
            tag: safeTag,
            notes: cleanNotes,
            visibility: 'shared',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        const remaining = getRemainingSeats(clampedCount);
        undoEntriesRef.current = null;
        showToast(
          `${label} guardada para ${cleanName} (${clampedCount}/10 · ${formatRemainingSeats(
            remaining
          ).toLowerCase()})`
        );
      } catch (error) {
        try {
          handleFirestoreError(
            error,
            alreadyExists ? OperationType.UPDATE : OperationType.CREATE,
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
            showToast(
              'No se pudo guardar la reserva. Verifica los datos e intenta de nuevo.'
            );
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
        batch.set(doc(db, COLLECTION_NAME, item.tableId), {
          tableId: item.tableId,
          toldoId: item.toldoId,
          tableNumber: item.tableNumber,
          guestName: item.guestName.slice(0, MAX_GUEST_NAME_LENGTH),
          guestsCount: Math.min(
            MAX_SEATS_PER_TABLE,
            Math.max(MIN_SEATS_PER_TABLE, Math.round(item.guestsCount))
          ),
          tag: item.tag,
          notes: item.notes.slice(0, MAX_NOTES_LENGTH),
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
        batch.set(doc(db, COLLECTION_NAME, tableId), {
          tableId,
          toldoId: parsed.toldoId,
          tableNumber: parsed.tableNumber,
          guestName: entry.guestName.slice(0, MAX_GUEST_NAME_LENGTH),
          guestsCount: Math.min(
            MAX_SEATS_PER_TABLE,
            Math.max(MIN_SEATS_PER_TABLE, Math.round(entry.guestsCount))
          ),
          tag: entry.tag,
          notes: entry.notes.slice(0, MAX_NOTES_LENGTH),
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

      setSaving(true);
      try {
        const batch = writeBatch(db);
        if (targetEntry) {
          // Atomic swap between two occupied tables
          batch.update(sourceRef, {
            guestName: targetEntry.guestName.slice(0, MAX_GUEST_NAME_LENGTH),
            guestsCount: Math.min(
              MAX_SEATS_PER_TABLE,
              Math.max(MIN_SEATS_PER_TABLE, Math.round(targetEntry.guestsCount))
            ),
            tag: targetEntry.tag,
            notes: targetEntry.notes.slice(0, MAX_NOTES_LENGTH),
            updatedAt: serverTimestamp(),
          });
          batch.update(targetRef, {
            guestName: sourceEntry.guestName.slice(0, MAX_GUEST_NAME_LENGTH),
            guestsCount: Math.min(
              MAX_SEATS_PER_TABLE,
              Math.max(MIN_SEATS_PER_TABLE, Math.round(sourceEntry.guestsCount))
            ),
            tag: sourceEntry.tag,
            notes: sourceEntry.notes.slice(0, MAX_NOTES_LENGTH),
            updatedAt: serverTimestamp(),
          });
        } else {
          // Move reservation to a free table
          batch.delete(sourceRef);
          batch.set(targetRef, {
            tableId: targetTableId,
            toldoId: targetParsed.toldoId,
            tableNumber: targetParsed.tableNumber,
            guestName: sourceEntry.guestName.slice(0, MAX_GUEST_NAME_LENGTH),
            guestsCount: Math.min(
              MAX_SEATS_PER_TABLE,
              Math.max(MIN_SEATS_PER_TABLE, Math.round(sourceEntry.guestsCount))
            ),
            tag: sourceEntry.tag,
            notes: sourceEntry.notes.slice(0, MAX_NOTES_LENGTH),
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
          if (assignments[tableId]) {
            batch.update(docRef, {
              guestName: entry.guestName,
              guestsCount: entry.guestsCount,
              tag: entry.tag,
              notes: entry.notes,
              updatedAt: serverTimestamp(),
            });
          } else {
            batch.set(docRef, {
              tableId,
              toldoId: parsed.toldoId,
              tableNumber: parsed.tableNumber,
              guestName: entry.guestName,
              guestsCount: entry.guestsCount,
              tag: entry.tag,
              notes: entry.notes,
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
          if (entry.tag === 'vip' || entry.tag === 'honor') {
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
    saveAssignment,
    freeTable,
    clearAllAssignments,
    clearToldoAssignments,
    moveOrSwapTable,
    importBackupJson,
    undoLastRemoval,
    importLocalReservations,
  };
}
