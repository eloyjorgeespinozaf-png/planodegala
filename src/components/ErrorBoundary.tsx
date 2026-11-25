import { Component, ErrorInfo, ReactNode } from 'react';
import {
  FIREBASE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
  isQuotaExceededError,
} from '../firebase';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Error inesperado en la aplicación.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isQuota = isQuotaExceededError(this.state.errorMessage);
    const isFreeDailyReads = this.state.errorMessage.includes(
      'Free daily read units per project'
    );
    const upgradeUrl = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/databases/${FIRESTORE_DATABASE_ID}/data?openUpgradeDialog=true`;

    return (
      <div className="min-h-screen bg-[#12100C] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#FBF9F5] border border-[#C9A959]/60 rounded-2xl shadow-2xl p-6 text-[#1F2421]">
          <p className="font-mono text-xs text-[#B59449] font-medium">
            Sincronización Firestore
          </p>
          <h1 className="font-display text-2xl font-bold mt-1">
            {isQuota
              ? 'Cuota diaria de Firestore alcanzada'
              : 'No se pudo completar la operación'}
          </h1>
          <p className="mt-3 text-sm text-[#5C635E] leading-relaxed">
            {isQuota
              ? 'Se alcanzó el límite gratuito diario de lectura/escritura de Firestore. La cuota se restablece al día siguiente.'
              : 'Ocurrió un error de permisos o conexión con la base de datos. Recarga la página o vuelve a iniciar sesión.'}
          </p>

          {isFreeDailyReads && (
            <p className="mt-3 text-xs text-[#5C635E] break-all">
              Consola Firebase:{' '}
              <a
                href={upgradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0F6B4E] underline"
              >
                Ver cuota del proyecto
              </a>
            </p>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0F6B4E] hover:bg-[#0B533C] rounded-lg transition-colors"
            >
              Recargar aplicación
            </button>
          </div>
        </div>
      </div>
    );
  }
}
