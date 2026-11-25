import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ConfirmResetModalProps {
  open: boolean;
  occupiedCount: number;
  saving?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmResetModal({
  open,
  occupiedCount,
  saving = false,
  onCancel,
  onConfirm,
}: ConfirmResetModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel, saving]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
    >
      <div
        className="absolute inset-0 bg-[#1F2421]/50 backdrop-blur-[2px]"
        onClick={() => {
          if (!saving) onCancel();
        }}
      />

      <div className="relative bg-white border border-[#E4DCCE] rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <h2
            id="reset-modal-title"
            className="font-display text-2xl font-bold text-[#1F2421]"
          >
            Limpiar todas las mesas
          </h2>
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            aria-label="Cerrar confirmación"
            className="p-1.5 text-[#5C635E] hover:text-[#1F2421] hover:bg-[#F3EFE6] disabled:opacity-40 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-3 text-sm text-[#5C635E] leading-relaxed">
          Se liberarán las{' '}
          <strong className="font-mono tabular-nums text-[#1F2421]">
            {occupiedCount}
          </strong>{' '}
          {occupiedCount === 1 ? 'mesa asignada' : 'mesas asignadas'} en
          Firestore. Podrás deshacer esta acción inmediatamente desde la
          notificación inferior.
        </p>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-[#5C635E] hover:text-[#1F2421] bg-[#F3EFE6] hover:bg-[#E4DCCE]/60 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
          >
            {saving ? 'Liberando...' : 'Liberar todo'}
          </button>
        </div>
      </div>
    </div>
  );
}
