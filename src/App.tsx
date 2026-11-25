import { useState } from 'react';
import { Upload } from 'lucide-react';
import { ActiveView, StatusFilter, TableSelection } from './types/seating';
import { useSeatingStore } from './hooks/useSeatingStore';
import { exportToCSV, exportToStandaloneHTML } from './utils/exporters';
import { TopBar } from './components/TopBar';
import { FloorPlanView } from './components/FloorPlanView';
import { GuestsListView } from './components/GuestsListView';
import { SummaryView } from './components/SummaryView';
import { AssignmentModal } from './components/AssignmentModal';
import { ConfirmResetModal } from './components/ConfirmResetModal';
import { ToastBanner } from './components/ToastBanner';

export default function App() {
  const {
    assignments,
    toldoStats,
    totals,
    loading,
    saving,
    toast,
    importableLocalCount,
    showToast,
    dismissToast,
    saveAssignment,
    freeTable,
    clearAllAssignments,
    undoLastRemoval,
    importLocalReservations,
  } = useSeatingStore();

  const [activeView, setActiveView] = useState<ActiveView>('plano');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todas');
  const [selectedTable, setSelectedTable] = useState<TableSelection | null>(
    null
  );
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [bgError, setBgError] = useState(false);

  const handleExportHTML = async () => {
    await exportToStandaloneHTML(assignments);
    showToast('Descargado archivo HTML único (plano-de-gala-mesas.html)');
  };

  const handleExportCSV = () => {
    exportToCSV(assignments);
    showToast('Exportado listado CSV (distribucion-mesas.csv)');
  };

  const handlePrint = () => {
    if (activeView !== 'plano') {
      setActiveView('plano');
      window.setTimeout(() => window.print(), 120);
    } else {
      window.print();
    }
  };

  const handleJumpToToldo = (toldoId: number) => {
    setActiveView('plano');
    window.setTimeout(() => {
      const target = document.getElementById(`toldo-${toldoId}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  return (
    <div className="relative min-h-screen bg-[#12100C] text-[#1F2421] flex flex-col">
      {/* Prominent high-contrast ceremonial wallpaper behind ivory floor plan panels */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none no-print bg-[#0A0907]"
      >
        {!bgError ? (
          <img
            src="/assets/aistudio/image_c6db970a.png"
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setBgError(true)}
            className="w-full h-full object-cover object-[48%_46%] scale-[1.13] opacity-90 contrast-[1.12] saturate-[1.12]"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#16130E] via-[#0F0D0A] to-[#1A150D]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#080705]/42 via-[#0A0806]/22 to-[#070604]/50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(6,5,4,0.58)_100%)]" />
      </div>

      <TopBar
        activeView={activeView}
        onChangeView={setActiveView}
        onExportHTML={handleExportHTML}
        onExportCSV={handleExportCSV}
        onPrint={handlePrint}
      />

      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
        {importableLocalCount > 0 && (
          <div className="mb-4 bg-[#0A0B0A]/80 backdrop-blur-sm border border-[#C9A959]/45 rounded-xl px-4 py-2.5 text-xs text-[#F3EFE6] flex flex-wrap items-center justify-between gap-3 no-print">
            <span>
              Se encontraron{' '}
              <strong className="font-mono tabular-nums text-[#F1D68A]">
                {importableLocalCount}
              </strong>{' '}
              {importableLocalCount === 1
                ? 'reserva guardada'
                : 'reservas guardadas'}{' '}
              en este navegador listas para sincronizar con la nube.
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={() => void importLocalReservations()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#FBF9F5] bg-[#0F6B4E] hover:bg-[#0B533C] disabled:opacity-50 border border-[#C9A959]/70 rounded-lg transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5 text-[#F1D68A]" aria-hidden="true" />
              <span>Subir a Firestore</span>
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-[#FBF9F5]/95 backdrop-blur-md border border-[#C9A959]/45 rounded-xl px-6 py-12 text-center shadow-[0_12px_32px_-16px_rgba(0,0,0,0.65)]">
            <p className="font-display text-2xl font-bold text-[#1F2421]">
              Cargando plano sincronizado...
            </p>
            <p className="mt-2 text-sm text-[#5C635E]">
              Conectando con la base de datos de reservas en Firebase Firestore.
            </p>
          </div>
        ) : (
          <>
            {activeView === 'plano' && (
              <FloorPlanView
                assignments={assignments}
                toldoStats={toldoStats}
                totals={totals}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                onSelectTable={setSelectedTable}
              />
            )}

            {activeView === 'invitados' && (
              <GuestsListView
                assignments={assignments}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                onSelectTable={setSelectedTable}
                onBackToPlan={() => setActiveView('plano')}
              />
            )}

            {activeView === 'resumen' && (
              <SummaryView
                toldoStats={toldoStats}
                totals={totals}
                saving={saving}
                onJumpToToldo={handleJumpToToldo}
                onRequestReset={() => setConfirmResetOpen(true)}
              />
            )}
          </>
        )}
      </main>

      <footer className="relative z-10 bg-[#0A0B0A]/80 backdrop-blur-sm border-t border-[#C9A959]/35 py-5 mt-8 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#F3EFE6]/80">
          <span>
            Plano de Gala · 7 toldos de comensales y pista de baile (Toldo 4)
          </span>
          <span>Sincronizado en tiempo real con Firebase Firestore</span>
        </div>
      </footer>

      <AssignmentModal
        selection={selectedTable}
        existing={
          selectedTable ? assignments[selectedTable.tableId] : undefined
        }
        saving={saving}
        onClose={() => setSelectedTable(null)}
        onSave={async (data) => {
          if (!selectedTable) return;
          await saveAssignment(
            selectedTable.tableId,
            data,
            `${selectedTable.toldoName} · Mesa ${selectedTable.tableNumber}`
          );
          setSelectedTable(null);
        }}
        onFree={async () => {
          if (!selectedTable) return;
          await freeTable(
            selectedTable.tableId,
            `${selectedTable.toldoName} · Mesa ${selectedTable.tableNumber}`
          );
          setSelectedTable(null);
        }}
      />

      <ConfirmResetModal
        open={confirmResetOpen}
        occupiedCount={totals.occupiedTables}
        saving={saving}
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={async () => {
          await clearAllAssignments();
          setConfirmResetOpen(false);
        }}
      />

      <ToastBanner
        toast={toast}
        onUndo={() => void undoLastRemoval()}
        onDismiss={dismissToast}
      />
    </div>
  );
}
