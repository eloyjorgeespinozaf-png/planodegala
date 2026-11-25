import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import {
  AssignmentsMap,
  MAX_EVENT_NOTICE_LENGTH,
  SEATING_TOLDOS,
  TAG_LABELS,
  TableSelection,
  buildTableId,
  formatRemainingSeats,
  formatSharedOccupantsSummary,
  getRemainingSeats,
} from '../types/seating';
import { ToldoStats } from '../hooks/useSeatingStore';

interface ControlPanelViewProps {
  assignments: AssignmentsMap;
  toldoStats: ToldoStats[];
  totals: {
    totalTables: number;
    occupiedTables: number;
    freeTables: number;
    assignedGuests: number;
    spareSeatsInReserved: number;
    totalCapacity: number;
    vipTables: number;
    occupancyRate: number;
  };
  savingTables: boolean;
  configLoading: boolean;
  isConfigured: boolean;
  isAdminUnlocked: boolean;
  savingConfig: boolean;
  reservationsLocked: boolean;
  editRequiresAdmin: boolean;
  eventNotice: string;
  onSetupPassword: (password: string) => Promise<{ ok: boolean; error?: string }>;
  onUnlock: (password: string) => Promise<{ ok: boolean; error?: string }>;
  onLock: () => void;
  onUpdateSettings: (next: {
    reservationsLocked: boolean;
    editRequiresAdmin: boolean;
    eventNotice: string;
  }) => Promise<boolean>;
  onChangePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onEditTable: (selection: TableSelection) => void;
  onFreeTable: (tableId: string, label: string) => Promise<void>;
  onMoveOrSwapTable: (
    sourceTableId: string,
    targetTableId: string
  ) => Promise<boolean>;
  onClearToldo: (toldoId: number, toldoName: string) => Promise<void>;
  onRequestResetAll: () => void;
  onExportBackupJSON: () => void;
  onImportBackupJSON: (
    raw: unknown
  ) => Promise<{ ok: boolean; count: number; error?: string }>;
}

export function ControlPanelView({
  assignments,
  toldoStats,
  totals,
  savingTables,
  configLoading,
  isConfigured,
  isAdminUnlocked,
  savingConfig,
  reservationsLocked,
  editRequiresAdmin,
  eventNotice,
  onSetupPassword,
  onUnlock,
  onLock,
  onUpdateSettings,
  onChangePassword,
  onEditTable,
  onFreeTable,
  onMoveOrSwapTable,
  onClearToldo,
  onRequestResetAll,
  onExportBackupJSON,
  onImportBackupJSON,
}: ControlPanelViewProps) {
  // First-run setup form
  const [setupPass, setSetupPass] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupError, setSetupError] = useState('');
  const [showSetupPass, setShowSetupPass] = useState(false);

  // Unlock form
  const [unlockPass, setUnlockPass] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [showUnlockPass, setShowUnlockPass] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Reservations management filters
  const [search, setSearch] = useState('');
  const [toldoFilter, setToldoFilter] = useState<number | 'all'>('all');

  // Quick assign free table
  const [quickToldoId, setQuickToldoId] = useState<number>(8);
  const [quickTableNum, setQuickTableNum] = useState<number>(1);

  // Inline move/swap state
  const [movingSourceId, setMovingSourceId] = useState<string | null>(null);
  const [moveTargetToldo, setMoveTargetToldo] = useState<number>(8);
  const [moveTargetNum, setMoveTargetNum] = useState<number>(1);

  // Settings local draft
  const [draftLocked, setDraftLocked] = useState(reservationsLocked);
  const [draftEditRequiresAdmin, setDraftEditRequiresAdmin] =
    useState(editRequiresAdmin);
  const [draftNotice, setDraftNotice] = useState(eventNotice);

  // Per-toldo clear confirmation
  const [clearToldoId, setClearToldoId] = useState<number>(8);
  const [confirmClearToldo, setConfirmClearToldo] = useState(false);

  // Password change form
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  const [passChangeError, setPassChangeError] = useState('');
  const [passChangeOk, setPassChangeOk] = useState('');

  // Backup import state
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftLocked(reservationsLocked);
    setDraftEditRequiresAdmin(editRequiresAdmin);
    setDraftNotice(eventNotice);
  }, [reservationsLocked, editRequiresAdmin, eventNotice]);

  const reservedRows = useMemo(() => {
    const rows: {
      tableId: string;
      toldoId: number;
      toldoName: string;
      tableNumber: number;
      guestName: string;
      guestsCount: number;
      remaining: number;
      tag: keyof typeof TAG_LABELS;
      notes: string;
    }[] = [];

    const q = search.trim().toLowerCase();

    for (const toldo of SEATING_TOLDOS) {
      if (toldoFilter !== 'all' && toldo.id !== toldoFilter) continue;
      const count = toldo.mesas ?? 15;
      for (let i = 1; i <= count; i++) {
        const tableId = buildTableId(toldo.id, i);
        const entry = assignments[tableId];
        if (!entry) continue;

        if (q) {
          const hay = [
            toldo.name,
            `mesa ${i}`,
            `m${i}`,
            entry.guestName,
            TAG_LABELS[entry.tag],
            entry.notes,
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) continue;
        }

        rows.push({
          tableId,
          toldoId: toldo.id,
          toldoName: toldo.name,
          tableNumber: i,
          guestName: formatSharedOccupantsSummary(entry),
          guestsCount: entry.guestsCount,
          remaining: getRemainingSeats(entry.guestsCount),
          tag: entry.tag,
          notes: entry.notes,
        });
      }
    }

    return rows;
  }, [assignments, search, toldoFilter]);

  const selectedClearToldoStat = useMemo(
    () => toldoStats.find((s) => s.toldoId === clearToldoId),
    [clearToldoId, toldoStats]
  );

  async function handleSetupSubmit(e: FormEvent) {
    e.preventDefault();
    setSetupError('');
    if (setupPass.length < 6) {
      setSetupError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (setupPass !== setupConfirm) {
      setSetupError('Las contraseñas no coinciden.');
      return;
    }
    const res = await onSetupPassword(setupPass);
    if (!res.ok) {
      setSetupError(res.error || 'No se pudo configurar la contraseña.');
      return;
    }
    setSetupPass('');
    setSetupConfirm('');
  }

  async function handleUnlockSubmit(e: FormEvent) {
    e.preventDefault();
    setUnlockError('');
    setVerifying(true);
    try {
      const res = await onUnlock(unlockPass);
      if (!res.ok) {
        setUnlockError(res.error || 'Contraseña incorrecta.');
        return;
      }
      setUnlockPass('');
    } finally {
      setVerifying(false);
    }
  }

  async function handleSettingsSubmit(e: FormEvent) {
    e.preventDefault();
    await onUpdateSettings({
      reservationsLocked: draftLocked,
      editRequiresAdmin: draftEditRequiresAdmin,
      eventNotice: draftNotice,
    });
  }

  async function handlePasswordChangeSubmit(e: FormEvent) {
    e.preventDefault();
    setPassChangeError('');
    setPassChangeOk('');
    if (newPass.length < 6) {
      setPassChangeError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPass !== confirmNewPass) {
      setPassChangeError('La confirmación de la nueva contraseña no coincide.');
      return;
    }
    const res = await onChangePassword(currentPass, newPass);
    if (!res.ok) {
      setPassChangeError(res.error || 'No se pudo actualizar la contraseña.');
      return;
    }
    setCurrentPass('');
    setNewPass('');
    setConfirmNewPass('');
    setPassChangeOk('Contraseña actualizada con éxito.');
  }

  async function handleBackupFileChange(e: ChangeEvent<HTMLInputElement>) {
    setImportError('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const res = await onImportBackupJSON(parsed);
      if (!res.ok) {
        setImportError(res.error || 'No se pudo importar el archivo.');
      }
    } catch {
      setImportError('El archivo seleccionado no es un JSON válido.');
    }
  }

  function openQuickTable() {
    const toldo = SEATING_TOLDOS.find((t) => t.id === quickToldoId);
    if (!toldo) return;
    onEditTable({
      tableId: buildTableId(toldo.id, quickTableNum),
      toldoId: toldo.id,
      toldoName: toldo.name,
      tableNumber: quickTableNum,
    });
  }

  if (configLoading) {
    return (
      <div className="bg-[#FBF9F5]/92 backdrop-blur-md border border-[#D4B45E]/65 rounded-xl px-6 py-12 text-center shadow-[0_18px_42px_-14px_rgba(0,0,0,0.82)]">
        <p className="font-display text-2xl font-bold text-[#1F2421]">
          Verificando Panel de Control...
        </p>
      </div>
    );
  }

  // First-run password creation (no hardcoded password in code)
  if (!isConfigured) {
    return (
      <div className="max-w-lg mx-auto py-4">
        <section className="bg-[#FBF9F5]/95 backdrop-blur-md border border-[#D4B45E]/70 rounded-2xl p-6 sm:p-8 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.85)]">
          <div className="flex items-center gap-3 pb-4 border-b border-[#E4DCCE]">
            <div className="w-10 h-10 rounded-xl bg-[#0F6B4E] text-[#F1D68A] flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1F2421] leading-tight">
                Configurar Panel de Control
              </h1>
              <p className="text-xs text-[#5C635E] mt-0.5">
                Primer acceso · Define tu contraseña de administrador
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm text-[#5C635E] leading-relaxed">
            Crea la contraseña que protegerá la edición de mesas reservadas,
            eliminación de reservas, traslados entre toldos, bloqueo del plano y
            respaldos. La contraseña se guarda cifrada (PBKDF2) en Firestore.
          </p>

          <form onSubmit={handleSetupSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="setup-admin-password"
                className="block text-xs font-semibold text-[#1F2421] mb-1.5"
              >
                Nueva contraseña (mínimo 6 caracteres)
              </label>
              <div className="relative">
                <input
                  id="setup-admin-password"
                  type={showSetupPass ? 'text' : 'password'}
                  value={setupPass}
                  onChange={(e) => {
                    setSetupPass(e.target.value);
                    if (setupError) setSetupError('');
                  }}
                  autoComplete="new-password"
                  placeholder="Ej. GalaPromocion2026"
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-white border border-[#E4DCCE] rounded-lg text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#0F6B4E]/30 focus:border-[#0F6B4E]"
                />
                <button
                  type="button"
                  onClick={() => setShowSetupPass((v) => !v)}
                  aria-label={
                    showSetupPass ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#5C635E] hover:text-[#1F2421]"
                >
                  {showSetupPass ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="setup-admin-confirm"
                className="block text-xs font-semibold text-[#1F2421] mb-1.5"
              >
                Confirmar contraseña
              </label>
              <input
                id="setup-admin-confirm"
                type={showSetupPass ? 'text' : 'password'}
                value={setupConfirm}
                onChange={(e) => {
                  setSetupConfirm(e.target.value);
                  if (setupError) setSetupError('');
                }}
                autoComplete="new-password"
                placeholder="Repite la contraseña"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E4DCCE] rounded-lg text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#0F6B4E]/30 focus:border-[#0F6B4E]"
              />
            </div>

            {setupError && (
              <p
                role="alert"
                className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5"
              >
                {setupError}
              </p>
            )}

            <button
              type="submit"
              disabled={savingConfig}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0F6B4E] hover:bg-[#0B533C] disabled:opacity-60 border border-[#C9A959]/70 rounded-xl transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-[#F1D68A]" aria-hidden="true" />
              <span>
                {savingConfig
                  ? 'Guardando contraseña...'
                  : 'Activar Panel de Control'}
              </span>
            </button>
          </form>
        </section>
      </div>
    );
  }

  // Locked password prompt
  if (!isAdminUnlocked) {
    return (
      <div className="max-w-md mx-auto py-4">
        <section className="bg-[#FBF9F5]/95 backdrop-blur-md border border-[#D4B45E]/70 rounded-2xl p-6 sm:p-8 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.85)]">
          <div className="flex items-center gap-3 pb-4 border-b border-[#E4DCCE]">
            <div className="w-10 h-10 rounded-xl bg-[#0A0B0A] text-[#F1D68A] border border-[#C9A959]/60 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1F2421] leading-tight">
                Panel de Control
              </h1>
              <p className="text-xs text-[#5C635E] mt-0.5">
                Acceso protegido con contraseña de administrador
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm text-[#5C635E] leading-relaxed">
            Ingresa la contraseña para editar mesas ocupadas, quitar reservas,
            mover invitados entre toldos, configurar reglas del salón o gestionar
            respaldos.
          </p>

          <form onSubmit={handleUnlockSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="unlock-admin-password"
                className="block text-xs font-semibold text-[#1F2421] mb-1.5"
              >
                Contraseña de administrador
              </label>
              <div className="relative">
                <input
                  id="unlock-admin-password"
                  type={showUnlockPass ? 'text' : 'password'}
                  value={unlockPass}
                  onChange={(e) => {
                    setUnlockPass(e.target.value);
                    if (unlockError) setUnlockError('');
                  }}
                  autoComplete="current-password"
                  autoFocus
                  placeholder="Ingresa tu contraseña"
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-white border border-[#E4DCCE] rounded-lg text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#0F6B4E]/30 focus:border-[#0F6B4E]"
                />
                <button
                  type="button"
                  onClick={() => setShowUnlockPass((v) => !v)}
                  aria-label={
                    showUnlockPass ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#5C635E] hover:text-[#1F2421]"
                >
                  {showUnlockPass ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {unlockError && (
              <p
                role="alert"
                className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5"
              >
                {unlockError}
              </p>
            )}

            <button
              type="submit"
              disabled={verifying}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0F6B4E] hover:bg-[#0B533C] disabled:opacity-60 border border-[#C9A959]/70 rounded-xl transition-colors"
            >
              <Unlock className="w-4 h-4 text-[#F1D68A]" aria-hidden="true" />
              <span>
                {verifying ? 'Verificando...' : 'Desbloquear Panel de Control'}
              </span>
            </button>
          </form>
        </section>
      </div>
    );
  }

  // Unlocked Executive Control Panel
  return (
    <div className="space-y-6">
      {/* Top Executive Header */}
      <section className="bg-[#FBF9F5]/92 backdrop-blur-md border border-[#D4B45E]/65 rounded-xl px-5 py-5 sm:px-7 sm:py-6 shadow-[0_18px_42px_-14px_rgba(0,0,0,0.82)] flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1F2421] tracking-tight">
            Panel de Control
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-[#5C635E]">
            <span className="font-mono tabular-nums font-semibold text-[#0F6B4E]">
              {totals.occupiedTables} / {totals.totalTables}
            </span>
            <span>mesas reservadas</span>
            <span aria-hidden="true" className="text-[#C9A959]">
              ·
            </span>
            <span className="font-mono tabular-nums font-medium text-[#1F2421]">
              {totals.assignedGuests.toLocaleString('es-ES')}
            </span>
            <span>sillas ocupadas</span>
            <span aria-hidden="true" className="text-[#C9A959]">
              ·
            </span>
            <span className="font-mono tabular-nums font-medium text-[#B59449]">
              {totals.spareSeatsInReserved.toLocaleString('es-ES')}
            </span>
            <span>sobrantes</span>
            <span aria-hidden="true" className="text-[#C9A959]">
              ·
            </span>
            <span className="font-mono tabular-nums font-medium text-[#1F2421]">
              {totals.freeTables}
            </span>
            <span>libres</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onLock}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-[#FBF9F5] bg-[#0A0B0A] hover:bg-[#1F2421] border border-[#D4B45E]/70 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Lock className="w-3.5 h-3.5 text-[#F1D68A]" aria-hidden="true" />
          <span>Bloquear panel</span>
        </button>
      </section>

      {/* Section 1: Table Reservation Management (Edit / Move / Swap / Remove) */}
      <section className="bg-white/92 backdrop-blur-sm border border-[#D4B45E]/65 rounded-xl overflow-hidden shadow-[0_18px_42px_-14px_rgba(0,0,0,0.82)]">
        <div className="px-5 py-4 sm:px-6 bg-[#F3EFE6]/92 border-b border-[#E4DCCE] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#1F2421]">
              Gestión de mesas y reservas
            </h2>
            <p className="text-xs text-[#5C635E] mt-0.5">
              Edita datos, cambia sillas, traslada o intercambia mesas y quita
              reservas al instante.
            </p>
          </div>

          {/* Quick open/assign any table */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Seleccionar toldo para asignar o editar"
              value={quickToldoId}
              onChange={(e) => setQuickToldoId(Number(e.target.value))}
              className="px-2.5 py-2 text-xs font-medium bg-white border border-[#E4DCCE] rounded-lg text-[#1F2421]"
            >
              {SEATING_TOLDOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Seleccionar número de mesa"
              value={quickTableNum}
              onChange={(e) => setQuickTableNum(Number(e.target.value))}
              className="px-2.5 py-2 text-xs font-mono tabular-nums bg-white border border-[#E4DCCE] rounded-lg text-[#1F2421]"
            >
              {Array.from({ length: 15 }, (_, idx) => idx + 1).map((n) => (
                <option key={n} value={n}>
                  Mesa {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={openQuickTable}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F6B4E] hover:bg-[#0B533C] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Abrir / Reservar mesa</span>
            </button>
          </div>
        </div>

        {/* Search & Toldo filter bar */}
        <div className="px-5 py-3.5 sm:px-6 border-b border-[#E4DCCE]/70 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-[#FBF9F5]/70">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-[#5C635E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por invitado, mesa, etiqueta o nota..."
              aria-label="Buscar reservas en el panel de control"
              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-[#E4DCCE] rounded-lg text-[#1F2421] placeholder:text-[#5C635E]/70 focus:outline-none focus:ring-2 focus:ring-[#0F6B4E]/25 focus:border-[#0F6B4E]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#5C635E] hover:text-[#1F2421]"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <select
            aria-label="Filtrar tabla por toldo"
            value={toldoFilter}
            onChange={(e) =>
              setToldoFilter(
                e.target.value === 'all' ? 'all' : Number(e.target.value)
              )
            }
            className="px-3 py-2 text-xs font-semibold bg-white border border-[#E4DCCE] rounded-lg text-[#1F2421]"
          >
            <option value="all">Todos los toldos ({totals.occupiedTables})</option>
            {toldoStats.map((s) => (
              <option key={s.toldoId} value={s.toldoId}>
                {s.toldoName} ({s.occupiedTables}/{s.totalTables})
              </option>
            ))}
          </select>
        </div>

        {reservedRows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-[#1F2421]">
              {totals.occupiedTables === 0
                ? 'Aún no hay mesas reservadas en el salón.'
                : 'Ninguna reserva coincide con el filtro actual.'}
            </p>
            <p className="mt-1 text-xs text-[#5C635E]">
              Usa el selector superior &ldquo;Abrir / Reservar mesa&rdquo; o haz
              clic directamente sobre cualquier mesa en el plano.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FBF9F5] border-b border-[#E4DCCE] text-xs font-semibold text-[#5C635E]">
                  <th className="py-3 px-5 whitespace-nowrap">Ubicación</th>
                  <th className="py-3 px-4 whitespace-nowrap">Invitado / Familia</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">
                    Sillas
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">Etiqueta</th>
                  <th className="py-3 px-4 whitespace-nowrap">Notas</th>
                  <th className="py-3 px-5 text-right whitespace-nowrap">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4DCCE]/70 text-sm">
                {reservedRows.map((row) => {
                  const isMoving = movingSourceId === row.tableId;
                  const targetTableId = buildTableId(
                    moveTargetToldo,
                    moveTargetNum
                  );
                  const targetOccupied = Boolean(assignments[targetTableId]);

                  return (
                    <tr
                      key={row.tableId}
                      className="hover:bg-[#FBF9F5]/80 transition-colors align-top"
                    >
                      <td className="py-3 px-5 font-mono tabular-nums text-xs font-semibold text-[#1F2421] whitespace-nowrap">
                        {row.toldoName} · M{row.tableNumber}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#1F2421]">
                        <div>{row.guestName}</div>
                        {isMoving && (
                          <div className="mt-2.5 p-3 bg-[#F3EFE6] border border-[#C9A959]/60 rounded-lg flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-[#1F2421]">
                              Destino:
                            </span>
                            <select
                              aria-label="Toldo de destino"
                              value={moveTargetToldo}
                              onChange={(e) =>
                                setMoveTargetToldo(Number(e.target.value))
                              }
                              className="px-2 py-1 text-xs bg-white border border-[#E4DCCE] rounded-md text-[#1F2421]"
                            >
                              {SEATING_TOLDOS.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            <select
                              aria-label="Mesa de destino"
                              value={moveTargetNum}
                              onChange={(e) =>
                                setMoveTargetNum(Number(e.target.value))
                              }
                              className="px-2 py-1 text-xs font-mono tabular-nums bg-white border border-[#E4DCCE] rounded-md text-[#1F2421]"
                            >
                              {Array.from({ length: 15 }, (_, i) => i + 1).map(
                                (num) => {
                                  const cid = buildTableId(moveTargetToldo, num);
                                  const occ = assignments[cid];
                                  return (
                                    <option key={num} value={num}>
                                      Mesa {num}{' '}
                                      {cid === row.tableId
                                        ? '(actual)'
                                        : occ
                                          ? `(Intercambiar: ${occ.guestName.slice(0, 18)})`
                                          : '(Libre)'}
                                    </option>
                                  );
                                }
                              )}
                            </select>
                            <button
                              type="button"
                              disabled={
                                savingTables || targetTableId === row.tableId
                              }
                              onClick={async () => {
                                const ok = await onMoveOrSwapTable(
                                  row.tableId,
                                  targetTableId
                                );
                                if (ok) setMovingSourceId(null);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-[#0F6B4E] hover:bg-[#0B533C] disabled:opacity-40 rounded-md whitespace-nowrap"
                            >
                              {targetOccupied
                                ? 'Intercambiar'
                                : 'Mover aquí'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setMovingSourceId(null)}
                              className="px-2 py-1 text-xs font-medium text-[#5C635E] hover:text-[#1F2421]"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="font-mono tabular-nums font-semibold text-[#0F6B4E]">
                          {row.guestsCount}/10
                        </span>
                        <span className="block font-mono tabular-nums text-[11px] text-[#B59449]">
                          {formatRemainingSeats(row.remaining)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-[#5C635E] whitespace-nowrap">
                        {TAG_LABELS[row.tag]}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#5C635E] max-w-[200px] truncate">
                        {row.notes || '—'}
                      </td>
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={savingTables}
                            onClick={() =>
                              onEditTable({
                                tableId: row.tableId,
                                toldoId: row.toldoId,
                                toldoName: row.toldoName,
                                tableNumber: row.tableNumber,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#1F2421] bg-[#F3EFE6] hover:bg-[#E4DCCE] rounded-md transition-colors whitespace-nowrap"
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            disabled={savingTables}
                            onClick={() => {
                              setMovingSourceId(
                                isMoving ? null : row.tableId
                              );
                              setMoveTargetToldo(row.toldoId);
                              setMoveTargetNum(row.tableNumber);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#0F6B4E] bg-[#0F6B4E]/10 hover:bg-[#0F6B4E]/20 rounded-md transition-colors whitespace-nowrap"
                          >
                            <ArrowLeftRight
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                            <span>Mover</span>
                          </button>
                          <button
                            type="button"
                            disabled={savingTables}
                            onClick={() =>
                              void onFreeTable(
                                row.tableId,
                                `${row.toldoName} · Mesa ${row.tableNumber}`
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors whitespace-nowrap"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Quitar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 2 & 3: Rules + Toldo Actions & Backups (2-column balanced grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Event Access Rules & Official Notice */}
        <section className="bg-[#FBF9F5]/92 backdrop-blur-md border border-[#D4B45E]/65 rounded-xl p-5 sm:p-6 shadow-[0_18px_42px_-14px_rgba(0,0,0,0.82)] flex flex-col">
          <h2 className="font-display text-2xl font-bold text-[#1F2421]">
            Reglas de acceso y aviso del evento
          </h2>
          <p className="text-xs text-[#5C635E] mt-1">
            Controla qué pueden hacer los invitados al entrar al plano público.
          </p>

          <form
            onSubmit={handleSettingsSubmit}
            className="mt-5 space-y-4 flex-1 flex flex-col"
          >
            <label className="flex items-start justify-between gap-4 p-3.5 bg-white border border-[#E4DCCE] rounded-lg cursor-pointer">
              <div>
                <span className="block text-sm font-semibold text-[#1F2421]">
                  Proteger mesas reservadas con contraseña
                </span>
                <span className="block text-xs text-[#5C635E] mt-0.5">
                  Los invitados pueden reservar mesas libres o sumar su familia
                  en sillas sobrantes, pero solo el administrador puede editar o
                  quitar reservas ya hechas.
                </span>
              </div>
              <input
                type="checkbox"
                checked={draftEditRequiresAdmin}
                onChange={(e) => setDraftEditRequiresAdmin(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#0F6B4E] shrink-0"
              />
            </label>

            <label className="flex items-start justify-between gap-4 p-3.5 bg-white border border-[#E4DCCE] rounded-lg cursor-pointer">
              <div>
                <span className="block text-sm font-semibold text-[#1F2421]">
                  Cerrar nuevas reservas públicas
                </span>
                <span className="block text-xs text-[#5C635E] mt-0.5">
                  Actívalo el día del evento para dejar el plano en modo solo
                  consulta para invitados (tú sigues pudiendo editar).
                </span>
              </div>
              <input
                type="checkbox"
                checked={draftLocked}
                onChange={(e) => setDraftLocked(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#0F6B4E] shrink-0"
              />
            </label>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="event-notice-input"
                  className="text-xs font-semibold text-[#1F2421]"
                >
                  Aviso oficial en el plano (opcional)
                </label>
                <span className="font-mono tabular-nums text-[11px] text-[#5C635E]">
                  {draftNotice.length} / {MAX_EVENT_NOTICE_LENGTH}
                </span>
              </div>
              <input
                id="event-notice-input"
                type="text"
                maxLength={MAX_EVENT_NOTICE_LENGTH}
                value={draftNotice}
                onChange={(e) => setDraftNotice(e.target.value)}
                placeholder="Ej. Recepción 19:30 hs · Confirmar asistencia en protocolo"
                className="w-full px-3.5 py-2 text-sm bg-white border border-[#E4DCCE] rounded-lg text-[#1F2421] placeholder:text-[#5C635E]/65 focus:outline-none focus:ring-2 focus:ring-[#0F6B4E]/25 focus:border-[#0F6B4E]"
              />
            </div>

            <div className="pt-2 mt-auto">
              <button
                type="submit"
                disabled={savingConfig}
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-[#0F6B4E] hover:bg-[#0B533C] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
              >
                {savingConfig ? 'Guardando...' : 'Guardar reglas del evento'}
              </button>
            </div>
          </form>
        </section>

        {/* Per-Toldo Actions, Backups & Mass Clear */}
        <section className="bg-[#FBF9F5]/92 backdrop-blur-md border border-[#D4B45E]/65 rounded-xl p-5 sm:p-6 shadow-[0_18px_42px_-14px_rgba(0,0,0,0.82)] flex flex-col justify-between gap-5">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#1F2421]">
              Respaldos y limpieza controlada
            </h2>
            <p className="text-xs text-[#5C635E] mt-1">
              Descarga copias de seguridad en JSON, restaura un respaldo o
              libera un toldo específico.
            </p>

            {/* Backup & Restore */}
            <div className="mt-5 pb-5 border-b border-[#E4DCCE] flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onExportBackupJSON}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1F2421] bg-white hover:bg-[#F3EFE6] border border-[#E4DCCE] rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-[#0F6B4E]" aria-hidden="true" />
                <span>Descargar respaldo JSON</span>
              </button>

              <button
                type="button"
                disabled={savingTables}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1F2421] bg-white hover:bg-[#F3EFE6] disabled:opacity-50 border border-[#E4DCCE] rounded-lg transition-colors whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 text-[#B59449]" aria-hidden="true" />
                <span>Restaurar respaldo JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleBackupFileChange}
                className="hidden"
              />

              {importError && (
                <p role="alert" className="w-full text-xs text-red-700 mt-1">
                  {importError}
                </p>
              )}
            </div>

            {/* Clear Single Toldo */}
            <div className="mt-5 pb-5 border-b border-[#E4DCCE]">
              <span className="block text-xs font-semibold text-[#1F2421] mb-2">
                Liberar un toldo completo
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Seleccionar toldo a liberar"
                  value={clearToldoId}
                  onChange={(e) => {
                    setClearToldoId(Number(e.target.value));
                    setConfirmClearToldo(false);
                  }}
                  className="px-3 py-2 text-xs font-medium bg-white border border-[#E4DCCE] rounded-lg text-[#1F2421]"
                >
                  {toldoStats.map((s) => (
                    <option key={s.toldoId} value={s.toldoId}>
                      {s.toldoName} ({s.occupiedTables} ocupadas)
                    </option>
                  ))}
                </select>

                {!confirmClearToldo ? (
                  <button
                    type="button"
                    disabled={
                      savingTables ||
                      (selectedClearToldoStat?.occupiedTables ?? 0) === 0
                    }
                    onClick={() => setConfirmClearToldo(true)}
                    className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-white hover:bg-red-50 disabled:opacity-40 border border-red-200 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Liberar toldo
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      disabled={savingTables}
                      onClick={async () => {
                        if (!selectedClearToldoStat) return;
                        await onClearToldo(
                          selectedClearToldoStat.toldoId,
                          selectedClearToldoStat.toldoName
                        );
                        setConfirmClearToldo(false);
                      }}
                      className="px-3 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg whitespace-nowrap"
                    >
                      Confirmar ({selectedClearToldoStat?.occupiedTables})
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearToldo(false)}
                      className="px-2.5 py-2 text-xs font-medium text-[#5C635E] hover:text-[#1F2421]"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Clear Entire Hall */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="block text-xs font-semibold text-[#1F2421]">
                Reiniciar todo el salón
              </span>
              <span className="text-xs text-[#5C635E]">
                Libera todas las mesas ocupadas de los 7 toldos.
              </span>
            </div>
            <button
              type="button"
              disabled={totals.occupiedTables === 0 || savingTables}
              onClick={onRequestResetAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-white hover:bg-red-50 disabled:opacity-40 border border-red-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Limpiar todo ({totals.occupiedTables})</span>
            </button>
          </div>
        </section>
      </div>

      {/* Section 4: Change Control Panel Password */}
      <section className="bg-[#FBF9F5]/92 backdrop-blur-md border border-[#D4B45E]/65 rounded-xl p-5 sm:p-6 shadow-[0_18px_42px_-14px_rgba(0,0,0,0.82)]">
        <h2 className="font-display text-2xl font-bold text-[#1F2421]">
          Cambiar contraseña del Panel de Control
        </h2>
        <p className="text-xs text-[#5C635E] mt-1">
          Actualiza la clave de administrador en cualquier momento. La sesión
          desbloqueada vive solo en la memoria de esta pestaña.
        </p>

        <form
          onSubmit={handlePasswordChangeSubmit}
          className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label
              htmlFor="cp-current-pass"
              className="block text-xs font-semibold text-[#1F2421] mb-1"
            >
              Contraseña actual
            </label>
            <input
              id="cp-current-pass"
              type="password"
              value={currentPass}
              onChange={(e) => {
                setCurrentPass(e.target.value);
                setPassChangeError('');
                setPassChangeOk('');
              }}
              autoComplete="current-password"
              className="w-full px-3 py-2 text-sm bg-white border border-[#E4DCCE] rounded-lg text-[#1F2421]"
            />
          </div>
          <div>
            <label
              htmlFor="cp-new-pass"
              className="block text-xs font-semibold text-[#1F2421] mb-1"
            >
              Nueva contraseña
            </label>
            <input
              id="cp-new-pass"
              type="password"
              value={newPass}
              onChange={(e) => {
                setNewPass(e.target.value);
                setPassChangeError('');
                setPassChangeOk('');
              }}
              autoComplete="new-password"
              className="w-full px-3 py-2 text-sm bg-white border border-[#E4DCCE] rounded-lg text-[#1F2421]"
            />
          </div>
          <div>
            <label
              htmlFor="cp-confirm-new-pass"
              className="block text-xs font-semibold text-[#1F2421] mb-1"
            >
              Confirmar nueva
            </label>
            <input
              id="cp-confirm-new-pass"
              type="password"
              value={confirmNewPass}
              onChange={(e) => {
                setConfirmNewPass(e.target.value);
                setPassChangeError('');
                setPassChangeOk('');
              }}
              autoComplete="new-password"
              className="w-full px-3 py-2 text-sm bg-white border border-[#E4DCCE] rounded-lg text-[#1F2421]"
            />
          </div>
          <button
            type="submit"
            disabled={savingConfig}
            className="h-[38px] px-4 text-xs font-semibold text-white bg-[#0F6B4E] hover:bg-[#0B533C] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
          >
            Actualizar contraseña
          </button>
        </form>

        {passChangeError && (
          <p role="alert" className="mt-2.5 text-xs text-red-700">
            {passChangeError}
          </p>
        )}
        {passChangeOk && (
          <p role="status" className="mt-2.5 text-xs text-[#0F6B4E] font-medium">
            {passChangeOk}
          </p>
        )}
      </section>
    </div>
  );
}
