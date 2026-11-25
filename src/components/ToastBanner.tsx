import { RotateCcw, X } from 'lucide-react';
import { ToastMessage } from '../hooks/useSeatingStore';

interface ToastBannerProps {
  toast: ToastMessage | null;
  onUndo: () => void;
  onDismiss: () => void;
}

export function ToastBanner({ toast, onUndo, onDismiss }: ToastBannerProps) {
  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-40 max-w-sm bg-[#1F2421] text-[#FBF9F5] border border-[#B59449]/40 rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 no-print"
    >
      <span className="text-xs sm:text-sm font-medium leading-snug">
        {toast.text}
      </span>

      {toast.canUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#C9A959] hover:text-white bg-white/10 hover:bg-white/15 rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Deshacer</span>
        </button>
      )}

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar notificación"
        className="p-1 text-[#F3EFE6]/70 hover:text-white rounded transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
