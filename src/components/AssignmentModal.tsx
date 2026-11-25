import { FormEvent, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  MAX_GUEST_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  SEATS_PER_TABLE,
  TAG_LABELS,
  TableAssignment,
  TableSelection,
  TableTag,
  getRemainingSeats,
} from '../types/seating';

interface AssignmentModalProps {
  selection: TableSelection | null;
  existing?: TableAssignment;
  saving?: boolean;
  onClose: () => void;
  onSave: (data: {
    guestName: string;
    guestsCount: number;
    tag: TableTag;
    notes: string;
  }) => void;
  onFree: () => void;
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
  saving = false,
  onClose,
  onSave,
  onFree,
}: AssignmentModalProps) {
  const [guestName, setGuestName] = useState('');
  const [selectedChairs, setSelectedChairs] = useState<number | null>(null);
  const [tag, setTag] = useState<TableTag>('estandar');
  const [notes, setNotes] = useState('');
  const [nameError, setNameError] = useState('');
  const [chairsError, setChairsError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selection) return;
    setGuestName(existing?.guestName ?? '');
    setSelectedChairs(existing ? Math.min(SEATS_PER_TABLE, Math.max(1, existing.guestsCount)) : null);
    setTag(existing?.tag ?? 'estandar');
    setNotes(existing?.notes ?? '');
    setNameError('');
    setChairsError('');

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
    return () => window.clearTimeout(timer);
  }, [selection, existing]);

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

  const isOccupied = Boolean(existing);
  const remainingChairs =
    selectedChairs !== null
      ? getRemainingSeats(selectedChairs)
      : SEATS_PER_TABLE;

  function handleSelectChairs(count: number) {
    if (saving) return;
    setSelectedChairs(count);
    if (chairsError) setChairsError('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const trimmed = guestName.trim();

    if (!trimmed) {
      if (isOccupied) {
        onFree();
        return;
      }
      setNameError('Ingresa el nombre del invitado o familia.');
      inputRef.current?.focus();
      return;
    }

    if (selectedChairs === null || selectedChairs < 1 || selectedChairs > SEATS_PER_TABLE) {
      setChairsError('Indica cuántas sillas se ocuparán en esta mesa (1 a 10).');
      return;
    }

    onSave({
      guestName: trimmed,
      guestsCount: selectedChairs,
      tag,
      notes: notes.trim(),
    });
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
        className="fixed inset-0 bg-[#1F2421]/50 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Dialog panel */}
      <div className="relative bg-white border border-[#E4DCCE] rounded-2xl shadow-2xl w-full max-w-lg p-6 my-auto">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E4DCCE]">
          <div>
            <p className="font-mono tabular-nums text-xs text-[#B59449] font-medium">
              {selection.toldoName} · Mesa {selection.tableNumber} · 10 sillas
            </p>
            <h2
              id="assignment-modal-title"
              className="font-display text-2xl font-bold text-[#1F2421] mt-0.5"
            >
              {isOccupied ? 'Editar reserva de mesa' : 'Reservar mesa'}
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

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Guest / Family Name */}
          <div>
            <label
              htmlFor="modal-guest-name"
              className="block text-xs font-semibold text-[#1F2421] mb-1.5"
            >
              Nombre del invitado o familia
            </label>
            <input
              ref={inputRef}
              id="modal-guest-name"
              type="text"
              value={guestName}
              disabled={saving}
              maxLength={MAX_GUEST_NAME_LENGTH}
              onChange={(e) => {
                setGuestName(e.target.value);
                if (nameError) setNameError('');
              }}
              autoComplete="off"
              placeholder="Ej. Familia Pérez"
              className="w-full px-3.5 py-2.5 text-sm bg-white disabled:bg-[#F3EFE6]/60 disabled:text-[#5C635E] border border-[#E4DCCE] rounded-lg text-[#1F2421] placeholder:text-[#5C635E]/65 focus:outline-none focus:ring-2 focus:ring-[#0F6B4E]/30 focus:border-[#0F6B4E] transition-colors"
            />
            {nameError && (
              <p className="mt-1.5 text-xs text-red-700" role="alert">
                {nameError}
              </p>
            )}
          </div>

          {/* Mandatory chair selector + live 10-chair visual table */}
          <div className="bg-[#FBF9F5] border border-[#E4DCCE] rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <span className="block text-xs font-semibold text-[#1F2421]">
                  ¿Cuántas sillas va a ocupar? (obligatorio)
                </span>
                <span className="text-xs text-[#5C635E]">
                  Selecciona de 1 a 10 sillas o haz clic directo en el dibujo
                </span>
              </div>
              <div className="font-mono tabular-nums text-xs text-[#1F2421] shrink-0">
                {selectedChairs !== null ? (
                  <>
                    <span className="font-semibold text-[#0F6B4E]">
                      {selectedChairs} ocup.
                    </span>
                    <span className="mx-1.5 text-[#C9A959]">·</span>
                    <span className="font-semibold text-[#B59449]">
                      {remainingChairs === 0
                        ? '0 sobran'
                        : remainingChairs === 1
                          ? 'sobra 1 silla'
                          : `sobran ${remainingChairs}`}
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
                  aria-label={`Vista previa de 10 sillas: ${
                    selectedChairs ?? 0
                  } ocupadas y ${remainingChairs} sobrantes`}
                >
                  {/* Tabletop circle */}
                  <circle
                    cx="88"
                    cy="88"
                    r="44"
                    fill={selectedChairs ? '#0F6B4E' : '#FFFFFF'}
                    stroke="#C9A959"
                    strokeWidth="2.5"
                  />
                  <text
                    x="88"
                    y="83"
                    textAnchor="middle"
                    className="font-mono text-[14px] font-semibold"
                    fill={selectedChairs ? '#FFFFFF' : '#1F2421'}
                  >
                    {selectedChairs !== null ? `${selectedChairs} / 10` : '— / 10'}
                  </text>
                  <text
                    x="88"
                    y="100"
                    textAnchor="middle"
                    className="text-[10px] font-medium"
                    fill={selectedChairs ? '#F3DF9E' : '#5C635E'}
                  >
                    {selectedChairs === null
                      ? 'Elige sillas'
                      : remainingChairs === 0
                        ? 'Mesa llena'
                        : remainingChairs === 1
                          ? 'Sobra 1 silla'
                          : `Sobran ${remainingChairs}`}
                  </text>

                  {/* 10 clickable chairs */}
                  {PREVIEW_CHAIRS.map((chair) => {
                    const isFilled =
                      selectedChairs !== null &&
                      chair.chairNumber <= selectedChairs;
                    return (
                      <g
                        key={chair.chairNumber}
                        transform={`translate(${chair.cx} ${chair.cy}) rotate(${chair.rotation})`}
                        onClick={() => handleSelectChairs(chair.chairNumber)}
                        className="cursor-pointer"
                      >
                        <title>
                          Ocupar {chair.chairNumber}{' '}
                          {chair.chairNumber === 1 ? 'silla' : 'sillas'} (
                          {SEATS_PER_TABLE - chair.chairNumber} sobrantes)
                        </title>
                        <rect
                          x="-9"
                          y="-9"
                          width="18"
                          height="5"
                          rx="2.5"
                          fill={isFilled ? '#0F6B4E' : '#FFFFFF'}
                          stroke={isFilled ? '#0B533C' : '#C9A959'}
                          strokeWidth="1.5"
                        />
                        <rect
                          x="-7.5"
                          y="-2.5"
                          width="15"
                          height="8.5"
                          rx="3"
                          fill={isFilled ? '#0F6B4E' : '#FFFFFF'}
                          stroke={isFilled ? '#0B533C' : '#C9A959'}
                          strokeWidth="1.5"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* 1 to 10 direct chair buttons */}
              <div className="flex-1 w-full">
                <div
                  role="group"
                  aria-label="Cantidad de sillas a ocupar"
                  className="grid grid-cols-5 gap-2"
                >
                  {Array.from({ length: SEATS_PER_TABLE }, (_, i) => i + 1).map(
                    (num) => {
                      const active = selectedChairs === num;
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
                    }
                  )}
                </div>

                {/* Live remaining chairs summary */}
                <p className="mt-2.5 text-xs text-[#5C635E]">
                  {selectedChairs === null ? (
                    'Cada mesa cuenta con 10 sillas en total.'
                  ) : remainingChairs === 0 ? (
                    'Mesa reservada al 100%: no sobran sillas.'
                  ) : remainingChairs === 1 ? (
                    <>
                      Quedará{' '}
                      <strong className="font-mono tabular-nums text-[#1F2421]">
                        1 silla sobrante
                      </strong>{' '}
                      en esta mesa reservada.
                    </>
                  ) : (
                    <>
                      Quedarán{' '}
                      <strong className="font-mono tabular-nums text-[#1F2421]">
                        {remainingChairs} sillas sobrantes
                      </strong>{' '}
                      en esta mesa reservada.
                    </>
                  )}
                </p>
              </div>
            </div>

            {chairsError && (
              <p className="mt-2.5 text-xs text-red-700 font-medium" role="alert">
                {chairsError}
              </p>
            )}
          </div>

          {/* Tag selector */}
          <div>
            <span className="block text-xs font-semibold text-[#1F2421] mb-1.5">
              Etiqueta de mesa
            </span>
            <div
              role="group"
              aria-label="Etiqueta de mesa"
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
              onChange={(e) => setNotes(e.target.value)}
              autoComplete="off"
              placeholder="Ej. Menú vegetariano, silla para bebé"
              className="w-full px-3.5 py-2 text-sm bg-white disabled:bg-[#F3EFE6]/60 disabled:text-[#5C635E] border border-[#E4DCCE] rounded-lg text-[#1F2421] placeholder:text-[#5C635E]/65 focus:outline-none focus:ring-2 focus:ring-[#0F6B4E]/30 focus:border-[#0F6B4E] transition-colors"
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-4 border-t border-[#E4DCCE] flex flex-wrap items-center justify-between gap-2">
            {isOccupied ? (
              <button
                type="button"
                disabled={saving}
                onClick={onFree}
                className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
              >
                Liberar mesa
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
                {saving ? 'Guardando...' : 'Guardar reserva'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
