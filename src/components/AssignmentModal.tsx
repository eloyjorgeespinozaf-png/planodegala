import { FormEvent, useEffect, useRef, useState } from 'react';
import { Lock, Pencil, Trash2, UserPlus, X } from 'lucide-react';
import {
  MAX_GUEST_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  SEATS_PER_TABLE,
  TAG_LABELS,
  TableAssignment,
  TableBooking,
  TableSelection,
  TableTag,
  formatRemainingSeats,
  getRemainingSeats,
  getTableBookings,
  toReservationUpper,
} from '../types/seating';

interface AssignmentModalProps {
  selection: TableSelection | null;
  existing?: TableAssignment;
  canAddBooking: boolean;
  canEditExisting: boolean;
  addLockReason?: string | null;
  editLockReason?: string | null;
  saving?: boolean;
  onClose: () => void;
  onOpenControlPanel?: () => void;
  onAddBooking: (
    booking: TableBooking
  ) => Promise<{ ok: boolean; error?: string }>;
  onUpdateBooking: (
    index: number,
    booking: TableBooking
  ) => Promise<{ ok: boolean; error?: string }>;
  onRemoveBooking: (index: number) => Promise<void>;
  onFreeAll: () => Promise<void>;
}

const TAG_OPTIONS: TableTag[] = ['estandar', 'vip', 'familia', 'honor'];

const PREVIEW_CHAIRS = Array.from({ length: SEATS_PER_TABLE }, (_, idx) => {
  const angleDeg = idx * 36 - 90;
  const angleRad = (angleDeg * Math.PI) / 180;
  const cx = Number((88 + 68 * Math.cos(angleRad)).toFixed(2));
  const cy = Number((88 + 68 * Math.sin(angleRad)).toFixed(2));
  return {
    chairNumber: idx + 1,
    cx,
    cy,
    rotation: angleDeg + 90,
  };
});

export function AssignmentModal({
  selection,
  existing,
  canAddBooking,
  canEditExisting,
  addLockReason = null,
  editLockReason = null,
  saving = false,
  onClose,
  onOpenControlPanel,
  onAddBooking,
  onUpdateBooking,
  onRemoveBooking,
  onFreeAll,
}: AssignmentModalProps) {
  const bookings = getTableBookings(existing);
  const currentTotalOccupied = bookings.reduce(
    (sum, b) => sum + b.guestsCount,
    0
  );
  const currentRemaining = getRemainingSeats(currentTotalOccupied);

  // null = adding a new booking (either first booking on free table, or co-reservation on shared table)
  // number = editing bookings[editingIndex]
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [guestName, setGuestName] = useState('');
  const [selectedChairs, setSelectedChairs] = useState<number | null>(null);
  const [tag, setTag] = useState<TableTag>('estandar');
  const [notes, setNotes] = useState('');
  const [nameError, setNameError] = useState('');
  const [chairsError, setChairsError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset form whenever the selected table changes
  useEffect(() => {
    if (!selection) return;
    setEditingIndex(null);
    setGuestName('');
    setSelectedChairs(null);
    setTag('estandar');
    setNotes('');
    setNameError('');
    setChairsError('');
    setSubmitError('');

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 25);
    return () => window.clearTimeout(timer);
  }, [selection]);

  // If the booking being edited was removed externally, exit edit mode cleanly
  useEffect(() => {
    if (editingIndex !== null && editingIndex >= bookings.length) {
      setEditingIndex(null);
      setGuestName('');
      setSelectedChairs(null);
      setTag('estandar');
      setNotes('');
    }
  }, [bookings.length, editingIndex]);

  useEffect(() => {
    if (!selection) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selection, onClose]);

  if (!selection) return null;

  const isOccupied = bookings.length > 0;
  const isEditing = editingIndex !== null && bookings[editingIndex] !== undefined;

  // Compute seat budget for the active form
  const lockedSeatsFromOthers = isEditing
    ? bookings.reduce(
        (sum, b, idx) => (idx === editingIndex ? sum : sum + b.guestsCount),
        0
      )
    : currentTotalOccupied;

  const maxSelectableChairs = Math.max(0, SEATS_PER_TABLE - lockedSeatsFromOthers);
  const effectiveSelected =
    selectedChairs !== null
      ? Math.min(maxSelectableChairs, Math.max(1, selectedChairs))
      : null;

  const previewTotalAfter =
    lockedSeatsFromOthers + (effectiveSelected ?? 0);
  const previewRemainingAfter = Math.max(
    0,
    SEATS_PER_TABLE - previewTotalAfter
  );

  const showForm = isEditing
    ? canEditExisting
    : canAddBooking && maxSelectableChairs > 0;

  function startEditingBooking(index: number) {
    if (!canEditExisting || saving) return;
    const target = bookings[index];
    if (!target) return;
    setEditingIndex(index);
    setGuestName(toReservationUpper(target.guestName));
    setSelectedChairs(target.guestsCount);
    setTag(target.tag);
    setNotes(toReservationUpper(target.notes));
    setNameError('');
    setChairsError('');
    setSubmitError('');
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
  }

  function cancelEditingBooking() {
    setEditingIndex(null);
    setGuestName('');
    setSelectedChairs(null);
    setTag('estandar');
    setNotes('');
    setNameError('');
    setChairsError('');
    setSubmitError('');
  }

  function handleSelectChairs(count: number) {
    if (!showForm || saving) return;
    if (count < 1 || count > maxSelectableChairs) return;
    setSelectedChairs(count);
    if (chairsError) setChairsError('');
    if (submitError) setSubmitError('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!showForm || saving) return;

    const trimmed = toReservationUpper(guestName.trim());
    if (!trimmed) {
      setNameError('Ingresa el nombre del invitado o familia.');
      inputRef.current?.focus();
      return;
    }

    if (
      effectiveSelected === null ||
      effectiveSelected < 1 ||
      effectiveSelected > maxSelectableChairs
    ) {
      setChairsError(
        maxSelectableChairs === 1
          ? 'Selecciona 1 silla disponible para completar la mesa.'
          : `Indica cuántas sillas se ocuparán (1 a ${maxSelectableChairs}).`
      );
      return;
    }

    setSubmitError('');
    const payload: TableBooking = {
      guestName: trimmed,
      guestsCount: effectiveSelected,
      tag,
      notes: toReservationUpper(notes.trim()),
    };

    const result = isEditing
      ? await onUpdateBooking(editingIndex, payload)
      : await onAddBooking(payload);

    if (!result.ok) {
      setSubmitError(result.error || 'No se pudo guardar la reserva.');
      return;
    }

    if (isEditing) {
      cancelEditingBooking();
    } else {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assignment-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1F2421]/55 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Dialog panel */}
      <div className="relative bg-white border border-[#E4DCCE] rounded-2xl shadow-2xl w-full max-w-lg p-5 sm:p-6 my-auto max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E4DCCE]">
          <div>
            <p className="font-mono tabular-nums text-xs text-[#B59449] font-medium">
              {selection.toldoName} · Mesa {selection.tableNumber} ·{' '}
              {currentTotalOccupied}/{SEATS_PER_TABLE} sillas ocupadas
            </p>
            <h2
              id="assignment-modal-title"
              className="font-display text-2xl font-bold text-[#1F2421] mt-0.5"
            >
              {!isOccupied
                ? 'Reservar mesa'
                : currentRemaining > 0
                  ? 'Completar mesa compartida'
                  : 'Detalle de mesa completa'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="p-2 -mr-1 -mt-1 text-[#5C635E] hover:text-[#1F2421] hover:bg-[#F3EFE6] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Live 10-chair visual status & existing reservations list */}
        {isOccupied && (
          <div className="mt-4 bg-[#FBF9F5] border border-[#E4DCCE] rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-xs font-semibold text-[#1F2421]">
                Familias / personas en esta mesa ({bookings.length})
              </span>
              <span className="font-mono tabular-nums text-xs font-semibold text-[#0F6B4E]">
                {currentTotalOccupied}/{SEATS_PER_TABLE} ocup. ·{' '}
                <span className="text-[#B59449]">
                  {formatRemainingSeats(currentRemaining)}
                </span>
              </span>
            </div>

            <div className="divide-y divide-[#E4DCCE]/80 bg-white border border-[#E4DCCE] rounded-lg overflow-hidden">
              {bookings.map((item, idx) => {
                const isBeingEdited = editingIndex === idx;
                const isVip = item.tag === 'vip' || item.tag === 'honor';
                return (
                  <div
                    key={`${item.guestName}-${idx}`}
                    className={`px-3 py-2.5 flex items-center justify-between gap-2.5 text-xs ${
                      isBeingEdited ? 'bg-[#F3EFE6]' : 'bg-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-[#1F2421] truncate">
                          {item.guestName}
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-[#0F6B4E]">
                          · {item.guestsCount}{' '}
                          {item.guestsCount === 1 ? 'silla' : 'sillas'}
                        </span>
                        {item.tag !== 'estandar' && (
                          <span
                            className={`font-medium ${
                              isVip ? 'text-[#B59449]' : 'text-[#5C635E]'
                            }`}
                          >
                            · {TAG_LABELS[item.tag]}
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-[11px] text-[#5C635E] truncate mt-0.5">
                          {item.notes}
                        </p>
                      )}
                    </div>

                    {canEditExisting ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            isBeingEdited
                              ? cancelEditingBooking()
                              : startEditingBooking(idx)
                          }
                          aria-label={`Editar reserva de ${item.guestName}`}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded font-semibold transition-colors ${
                            isBeingEdited
                              ? 'bg-[#0F6B4E] text-white'
                              : 'text-[#1F2421] bg-[#F3EFE6] hover:bg-[#E4DCCE]'
                          }`}
                        >
                          <Pencil className="w-3 h-3" aria-hidden="true" />
                          <span>{isBeingEdited ? 'Editando' : 'Editar'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void onRemoveBooking(idx)}
                          aria-label={`Quitar a ${item.guestName} de esta mesa`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                          <span>Quitar</span>
                        </button>
                      </div>
                    ) : (
                      <span
                        title="Protegida por contraseña de administrador"
                        className="inline-flex items-center gap-1 text-[11px] text-[#5C635E] shrink-0"
                      >
                        <Lock className="w-3 h-3 text-[#B59449]" aria-hidden="true" />
                        <span>Protegida</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {!canEditExisting && editLockReason && currentRemaining === 0 && (
              <div className="mt-3 px-3 py-2.5 bg-white border border-[#C9A959]/60 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs text-[#1F2421] leading-relaxed">
                  {editLockReason}
                </p>
                {onOpenControlPanel && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenControlPanel();
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0F6B4E] hover:bg-[#0B533C] rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    Ir a Control
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Notice when adding new reservations is locked */}
        {!isEditing && !canAddBooking && maxSelectableChairs > 0 && addLockReason && (
          <div className="mt-4 px-3.5 py-3 bg-[#F3EFE6] border border-[#C9A959]/65 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <p className="text-xs text-[#1F2421] leading-relaxed">
              {addLockReason}
            </p>
            {onOpenControlPanel && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenControlPanel();
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0F6B4E] hover:bg-[#0B533C] rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Ir a Control
              </button>
            )}
          </div>
        )}

        {/* Notice when table is completely full (10/10) and not editing */}
        {isOccupied && currentRemaining === 0 && !isEditing && (
          <div className="mt-4 px-3.5 py-3 bg-[#0F6B4E]/8 border border-[#0F6B4E]/30 rounded-lg text-xs text-[#1F2421]">
            <strong className="text-[#0F6B4E]">Mesa completa (10/10 sillas).</strong>{' '}
            Todas las sillas de esta mesa ya están asignadas.
            {canEditExisting &&
              ' Puedes editar o quitar alguna reserva arriba si necesitas ajustar cupos.'}
          </div>
        )}

        {/* Add / Complete / Edit Booking Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {isOccupied && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0F6B4E]">
                  <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {isEditing
                      ? `Editando reserva de ${bookings[editingIndex].guestName}`
                      : `Sumar otra familia o persona (${maxSelectableChairs} ${
                          maxSelectableChairs === 1
                            ? 'silla libre'
                            : 'sillas libres'
                        })`}
                  </span>
                </div>
                {isEditing && (
                  <button
                    type="button"
                    onClick={cancelEditingBooking}
                    className="text-xs font-semibold text-[#5C635E] hover:text-[#1F2421] underline underline-offset-2"
                  >
                    Cancelar edición
                  </button>
                )}
              </div>
            )}

            {/* Guest / Family Name */}
            <div>
              <label
                htmlFor="modal-guest-name"
                className="block text-xs font-semibold text-[#1F2421] mb-1.5"
              >
                {isOccupied && !isEditing
                  ? 'Nombre de la otra familia o persona (EN MAYÚSCULAS)'
                  : 'Nombre del invitado o familia (EN MAYÚSCULAS)'}
              </label>
              <input
                ref={inputRef}
                id="modal-guest-name"
                type="text"
                value={guestName}
                disabled={saving}
                maxLength={MAX_GUEST_NAME_LENGTH}
                onChange={(e) => {
                  setGuestName(toReservationUpper(e.target.value));
                  if (nameError) setNameError('');
                  if (submitError) setSubmitError('');
                }}
                autoComplete="off"
                placeholder={
                  isOccupied && !isEditing
                    ? 'EJ. FAMILIA ROJAS / CARLOS MENDOZA'
                    : 'EJ. FAMILIA PÉREZ'
                }
                className="w-full px-3.5 py-2.5 text-sm uppercase bg-white disabled:bg-[#F3EFE6]/60 border border-[#E4DCCE] rounded-lg text-[#1F2421] placeholder:text-[#5C635E]/65 focus:outline-none focus:ring-2 focus:ring-[#0F6B4E]/30 focus:border-[#0F6B4E] transition-colors"
              />
              {nameError && (
                <p className="mt-1.5 text-xs text-red-700" role="alert">
                  {nameError}
                </p>
              )}
            </div>

            {/* Chair selector + live 10-chair visual table */}
            <div className="bg-[#FBF9F5] border border-[#E4DCCE] rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <span className="block text-xs font-semibold text-[#1F2421]">
                    {isOccupied && !isEditing
                      ? `¿Cuántas de las ${maxSelectableChairs} sillas libres ocupará?`
                      : `¿Cuántas sillas va a ocupar? (1 a ${maxSelectableChairs})`}
                  </span>
                  <span className="text-xs text-[#5C635E]">
                    {isOccupied && !isEditing
                      ? 'En verde las ya ocupadas; en dorado las sillas que sumas'
                      : 'Selecciona el número de sillas o haz clic en el dibujo'}
                  </span>
                </div>
                <div className="font-mono tabular-nums text-xs text-[#1F2421] shrink-0">
                  {effectiveSelected !== null ? (
                    <>
                      <span className="font-semibold text-[#0F6B4E]">
                        {previewTotalAfter}/10
                      </span>
                      <span className="mx-1.5 text-[#C9A959]">·</span>
                      <span className="font-semibold text-[#B59449]">
                        {previewRemainingAfter === 0
                          ? 'Mesa llena'
                          : previewRemainingAfter === 1
                            ? 'sobra 1 silla'
                            : `sobran ${previewRemainingAfter}`}
                      </span>
                    </>
                  ) : (
                    <span className="text-[#5C635E]">Sin seleccionar</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Interactive 10-chair circular table preview */}
                <div className="relative w-36 h-36 shrink-0">
                  <svg
                    viewBox="0 0 176 176"
                    className="w-full h-full"
                    role="img"
                    aria-label={`Vista previa de 10 sillas: ${lockedSeatsFromOthers} ya ocupadas, ${
                      effectiveSelected ?? 0
                    } seleccionadas y ${previewRemainingAfter} libres`}
                  >
                    <circle
                      cx="88"
                      cy="88"
                      r="44"
                      fill={previewTotalAfter > 0 ? '#0F6B4E' : '#FFFFFF'}
                      stroke="#C9A959"
                      strokeWidth="2.5"
                    />
                    <text
                      x="88"
                      y="83"
                      textAnchor="middle"
                      className="font-mono text-[14px] font-semibold"
                      fill={previewTotalAfter > 0 ? '#FFFFFF' : '#1F2421'}
                    >
                      {previewTotalAfter} / 10
                    </text>
                    <text
                      x="88"
                      y="100"
                      textAnchor="middle"
                      className="text-[10px] font-medium"
                      fill={previewTotalAfter > 0 ? '#F3DF9E' : '#5C635E'}
                    >
                      {effectiveSelected === null
                        ? isOccupied && !isEditing
                          ? `Quedan ${maxSelectableChairs}`
                          : 'Elige sillas'
                        : previewRemainingAfter === 0
                          ? 'Mesa completa'
                          : previewRemainingAfter === 1
                            ? 'Sobra 1 silla'
                            : `Sobran ${previewRemainingAfter}`}
                    </text>

                    {/* 10 chairs: emerald = already occupied by others, gold = newly added, white = open */}
                    {PREVIEW_CHAIRS.map((chair) => {
                      const isOtherOccupied =
                        chair.chairNumber <= lockedSeatsFromOthers;
                      const isNewSelection =
                        !isOtherOccupied &&
                        effectiveSelected !== null &&
                        chair.chairNumber <=
                          lockedSeatsFromOthers + effectiveSelected;

                      const chairFill = isOtherOccupied
                        ? '#0F6B4E'
                        : isNewSelection
                          ? isOccupied && !isEditing
                            ? '#C9A959'
                            : '#0F6B4E'
                          : '#FFFFFF';
                      const chairStroke = isOtherOccupied
                        ? '#0B533C'
                        : isNewSelection
                          ? isOccupied && !isEditing
                            ? '#8E6D24'
                            : '#0B533C'
                          : '#C9A959';

                      const clickableCount =
                        chair.chairNumber - lockedSeatsFromOthers;
                      const canClickChair =
                        clickableCount >= 1 &&
                        clickableCount <= maxSelectableChairs;

                      return (
                        <g
                          key={chair.chairNumber}
                          transform={`translate(${chair.cx} ${chair.cy}) rotate(${chair.rotation})`}
                          onClick={() => {
                            if (canClickChair) {
                              handleSelectChairs(clickableCount);
                            }
                          }}
                          className={
                            canClickChair ? 'cursor-pointer' : 'cursor-default'
                          }
                        >
                          <title>
                            {isOtherOccupied
                              ? `Silla ${chair.chairNumber} ya ocupada`
                              : `Ocupar ${clickableCount} ${
                                  clickableCount === 1 ? 'silla' : 'sillas'
                                } (${
                                  maxSelectableChairs - clickableCount
                                } sobrantes)`}
                          </title>
                          <rect
                            x="-9"
                            y="-9"
                            width="18"
                            height="5"
                            rx="2.5"
                            fill={chairFill}
                            stroke={chairStroke}
                            strokeWidth="1.5"
                          />
                          <rect
                            x="-7.5"
                            y="-2.5"
                            width="15"
                            height="8.5"
                            rx="3"
                            fill={chairFill}
                            stroke={chairStroke}
                            strokeWidth="1.5"
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* 1 to maxSelectableChairs buttons + quick "Complete table" shortcut */}
                <div className="flex-1 w-full">
                  <div
                    role="group"
                    aria-label="Cantidad de sillas a ocupar"
                    className="grid grid-cols-5 gap-2"
                  >
                    {Array.from(
                      { length: maxSelectableChairs },
                      (_, i) => i + 1
                    ).map((num) => {
                      const active = effectiveSelected === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          disabled={saving}
                          onClick={() => handleSelectChairs(num)}
                          className={`h-10 rounded-lg font-mono tabular-nums text-sm font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6B4E] disabled:opacity-70 ${
                            active
                              ? 'bg-[#0F6B4E] text-white border-[#0B533C]'
                              : 'bg-white text-[#1F2421] border-[#E4DCCE] hover:border-[#B59449] hover:bg-[#F3EFE6]/60'
                          }`}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>

                  {isOccupied && !isEditing && maxSelectableChairs > 1 && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSelectChairs(maxSelectableChairs)}
                      className="mt-2.5 w-full py-1.5 px-3 text-xs font-semibold text-[#0F6B4E] bg-[#0F6B4E]/10 hover:bg-[#0F6B4E]/18 border border-[#0F6B4E]/30 rounded-lg transition-colors"
                    >
                      Completar mesa con las {maxSelectableChairs} sillas
                      restantes
                    </button>
                  )}

                  <p className="mt-2 text-xs text-[#5C635E]">
                    {effectiveSelected === null ? (
                      isOccupied && !isEditing ? (
                        `Quedan ${maxSelectableChairs} ${
                          maxSelectableChairs === 1
                            ? 'silla disponible'
                            : 'sillas disponibles'
                        } para completar las 10 sillas.`
                      ) : (
                        'Cada mesa cuenta con 10 sillas en total.'
                      )
                    ) : previewRemainingAfter === 0 ? (
                      'La mesa quedará completa al 100% (10 de 10 sillas).'
                    ) : previewRemainingAfter === 1 ? (
                      <>
                        Aún quedará{' '}
                        <strong className="font-mono tabular-nums text-[#1F2421]">
                          1 silla libre
                        </strong>{' '}
                        disponible para otra persona.
                      </>
                    ) : (
                      <>
                        Aún quedarán{' '}
                        <strong className="font-mono tabular-nums text-[#1F2421]">
                          {previewRemainingAfter} sillas libres
                        </strong>{' '}
                        para completar la mesa.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {chairsError && (
                <p
                  className="mt-2.5 text-xs text-red-700 font-medium"
                  role="alert"
                >
                  {chairsError}
                </p>
              )}
            </div>

            {/* Tag selector */}
            <div>
              <span className="block text-xs font-semibold text-[#1F2421] mb-1.5">
                Etiqueta
              </span>
              <div
                role="group"
                aria-label="Etiqueta de reserva"
                className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#F3EFE6] border border-[#E4DCCE] rounded-lg"
              >
                {TAG_OPTIONS.map((option) => {
                  const isSelected = tag === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={saving}
                      onClick={() => setTag(option)}
                      className={`px-2.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap disabled:opacity-70 ${
                        isSelected
                          ? option === 'vip' || option === 'honor'
                            ? 'bg-white text-[#B59449] shadow-xs'
                            : 'bg-white text-[#0F6B4E] shadow-xs'
                          : 'text-[#5C635E] hover:text-[#1F2421]'
                      }`}
                    >
                      {TAG_LABELS[option]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional notes */}
            <div>
              <label
                htmlFor="modal-guest-notes"
                className="block text-xs font-semibold text-[#1F2421] mb-1.5"
              >
                Notas opcionales
              </label>
              <input
                id="modal-guest-notes"
                type="text"
                value={notes}
                disabled={saving}
                maxLength={MAX_NOTES_LENGTH}
                onChange={(e) => setNotes(toReservationUpper(e.target.value))}
                autoComplete="off"
                placeholder="EJ. MENÚ VEGETARIANO, SILLA PARA BEBÉ"
                className="w-full px-3.5 py-2 text-sm uppercase bg-white disabled:bg-[#F3EFE6]/60 border border-[#E4DCCE] rounded-lg text-[#1F2421] placeholder:text-[#5C635E]/65 focus:outline-none focus:ring-2 focus:ring-[#0F6B4E]/30 focus:border-[#0F6B4E] transition-colors"
              />
            </div>

            {submitError && (
              <p
                role="alert"
                className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5"
              >
                {submitError}
              </p>
            )}

            {/* Form submit row */}
            <div className="pt-3 border-t border-[#E4DCCE] flex flex-wrap items-center justify-between gap-2">
              {isOccupied && canEditExisting ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void onFreeAll()}
                  className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  Liberar mesa completa
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-[#5C635E] hover:text-[#1F2421] bg-[#F3EFE6] hover:bg-[#E4DCCE]/60 rounded-lg transition-colors whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F6B4E] hover:bg-[#0B533C] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                >
                  {saving
                    ? 'Guardando...'
                    : isEditing
                      ? 'Guardar cambios'
                      : isOccupied
                        ? effectiveSelected === maxSelectableChairs
                          ? `Completar mesa (+${effectiveSelected})`
                          : effectiveSelected
                            ? `Sumar a la mesa (+${effectiveSelected})`
                            : 'Sumar a la mesa'
                        : 'Guardar reserva'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Footer when form is hidden (full table or locked new reservations) */}
        {!showForm && (
          <div className="mt-5 pt-4 border-t border-[#E4DCCE] flex flex-wrap items-center justify-between gap-2">
            {isOccupied && canEditExisting ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void onFreeAll()}
                className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
              >
                Liberar mesa completa
              </button>
            ) : (
              <span />
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#5C635E] hover:text-[#1F2421] bg-[#F3EFE6] hover:bg-[#E4DCCE]/60 rounded-lg transition-colors whitespace-nowrap ml-auto"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
