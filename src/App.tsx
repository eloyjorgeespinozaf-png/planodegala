import { useState } from 'react';
import { Lock, Upload } from 'lucide-react';
import { ActiveView, StatusFilter, TableSelection } from './types/seating';
import { useSeatingStore } from './hooks/useSeatingStore';
import { useControlPanel } from './hooks/useControlPanel';
import {
  exportToBackupJSON,
  exportToCSV,
  exportToStandaloneHTML,
} from './utils/exporters';
import { TopBar } from './components/TopBar';
import { CroquisView } from './components/CroquisView';
import { GuestsListView } from './components/GuestsListView';
import { SummaryView } from './components/SummaryView';
import { ControlPanelView } from './components/ControlPanelView';
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
  } = useSeatingStore();

  const {
    configLoading,
    isConfigured,
    isAdminUnlocked,
    savingConfig,
    reservationsLocked,
    editRequiresAdmin,
    eventNotice,
    setupPassword,
    unlockWithPassword,
    lockPanel,
    updateSettings,
    changePassword,
  } = useControlPanel(showToast);

  const [activeView, setActiveView] = useState<ActiveView>('croquis');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todas');
  const [selectedTable, setSelectedTable] = useState<TableSelection | null>(
    null
  );
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [bgError, setBgError] = useState(false);
  const [pendingFocusToldoId, setPendingFocusToldoId] = useState<number | null>(
    null
  );

  const handleExportHTML = async () => {
    await exportToStandaloneHTML(assignments);
    showToast('Descargado archivo HTML único (plano-de-gala-mesas.html)');
  };

  const handleExportCSV = () => {
    exportToCSV(assignments);
    showToast('Exportado listado CSV (distribucion-mesas.csv)');
  };

  const handleExportBackupJSON = () => {
    exportToBackupJSON(assignments);
    showToast('Descargado respaldo JSON (respaldo-plano-gala.json)');
  };

  const handlePrint = () => {
    if (activeView !== 'croquis') {
      setActiveView('croquis');
      window.setTimeout(() => window.print(), 220);
    } else {
      window.print();
    }
  };

  const handleJumpToToldo = (toldoId: number) => {
    setPendingFocusToldoId(toldoId);
    setActiveView('croquis');
  };

  // Compute modal permissions: guests can complete spare chairs unless reservationsLocked is ON
  const selectedExisting = selectedTable
    ? assignments[selectedTable.tableId]
    : undefined;

  const canAddBooking = isAdminUnlocked || !reservationsLocked;
  const canEditExisting = isAdminUnlocked || !editRequiresAdmin;

  const addLockReason = !canAddBooking
    ? 'Las reservas nuevas están cerradas temporalmente por la organización. Solo el Panel de Control puede asignar o completar mesas.'
    : null;
  const editLockReason = !canEditExisting
    ? 'Las reservas ya existentes están protegidas. Desbloquea el Panel de Control con contraseña para editar o quitar reservas previas.'
    : null;

  const canResetAll = !editRequiresAdmin || isAdminUnlocked;

  return (
    <div className="relative min-h-screen bg-[#12100C] print:bg-white text-[#1F2421] flex flex-col">
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

      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8 print:max-w-none print:p-0 print:m-0">
        {/* Admin unlocked session strip when viewing other tabs */}
        {isAdminUnlocked && activeView !== 'control' && (
          <div className="mb-4 bg-[#0A0B0A]/85 backdrop-blur-sm border border-[#D4B45E]/60 rounded-xl px-4 py-2.5 text-xs text-[#F3EFE6] flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-[#F1D68A]">
                Panel de Control activo
              </span>
              <span aria-hidden="true" className="text-[#C9A959]">
                ·
              </span>
              <span className="text-[#F3EFE6]/85">
                Edición y liberación de mesas habilitadas en esta sesión
              </span>
            </div>
            <button
              type="button"
              onClick={lockPanel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#FBF9F5] bg-white/10 hover:bg-white/15 border border-[#C9A959]/45 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5 text-[#F1D68A]" aria-hidden="true" />
              <span>Bloquear</span>
            </button>
          </div>
        )}

        {/* Official event notice configured in Control Panel */}
        {eventNotice && activeView !== 'control' && (
          <div className="mb-4 bg-[#0A0B0A]/82 backdrop-blur-sm border border-[#D4B45E]/60 rounded-xl px-4 py-3 text-xs sm:text-sm text-[#FBF9F5] flex flex-wrap items-center justify-between gap-2 shadow-md no-print">
            <span>{eventNotice}</span>
            {reservationsLocked && (
              <span className="font-semibold text-[#F1D68A] whitespace-nowrap">
                Reservas cerradas
              </span>
            )}
          </div>
        )}

        {/* Legacy local browser storage migration prompt */}
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
              Cargando croquis sincronizado...
            </p>
            <p className="mt-2 text-sm text-[#5C635E]">
              Conectando con la base de datos de reservas en Firebase Firestore.
            </p>
          </div>
        ) : (
          <>
            {activeView === 'croquis' && (
              <CroquisView
                assignments={assignments}
                toldoStats={toldoStats}
                totals={totals}
                onSelectTable={setSelectedTable}
                onPrint={handlePrint}
                initialFocusToldoId={pendingFocusToldoId}
                onClearInitialFocus={() => setPendingFocusToldoId(null)}
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
                onBackToPlan={() => setActiveView('croquis')}
              />
            )}

            {activeView === 'resumen' && (
              <SummaryView
                toldoStats={toldoStats}
                totals={totals}
                canResetAll={canResetAll}
                saving={saving}
                onJumpToToldo={handleJumpToToldo}
                onRequestReset={() => setConfirmResetOpen(true)}
                onOpenControlPanel={() => setActiveView('control')}
              />
            )}

            {activeView === 'control' && (
              <ControlPanelView
                assignments={assignments}
                toldoStats={toldoStats}
                totals={totals}
                savingTables={saving}
                configLoading={configLoading}
                isConfigured={isConfigured}
                isAdminUnlocked={isAdminUnlocked}
                savingConfig={savingConfig}
                reservationsLocked={reservationsLocked}
                editRequiresAdmin={editRequiresAdmin}
                eventNotice={eventNotice}
                onSetupPassword={setupPassword}
                onUnlock={unlockWithPassword}
                onLock={lockPanel}
                onUpdateSettings={updateSettings}
                onChangePassword={changePassword}
                onEditTable={setSelectedTable}
                onFreeTable={freeTable}
                onMoveOrSwapTable={moveOrSwapTable}
                onClearToldo={clearToldoAssignments}
                onRequestResetAll={() => setConfirmResetOpen(true)}
                onExportBackupJSON={handleExportBackupJSON}
                onImportBackupJSON={importBackupJson}
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
        existing={selectedExisting}
        canAddBooking={canAddBooking}
        canEditExisting={canEditExisting}
        addLockReason={addLockReason}
        editLockReason={editLockReason}
        saving={saving}
        onClose={() => setSelectedTable(null)}
        onOpenControlPanel={() => setActiveView('control')}
        onAddBooking={async (booking) => {
          if (!selectedTable || !canAddBooking) {
            return { ok: false, error: 'Las reservas están bloqueadas.' };
          }
          return await addBookingToTable(
            selectedTable.tableId,
            booking,
            `${selectedTable.toldoName} · Mesa ${selectedTable.tableNumber}`
          );
        }}
        onUpdateBooking={async (index, booking) => {
          if (!selectedTable || !canEditExisting) {
            return { ok: false, error: 'Requiere desbloquear Panel de Control.' };
          }
          return await updateBookingAtIndex(
            selectedTable.tableId,
            index,
            booking,
            `${selectedTable.toldoName} · Mesa ${selectedTable.tableNumber}`
          );
        }}
        onRemoveBooking={async (index) => {
          if (!selectedTable || !canEditExisting) return;
          const prevCount = selectedExisting?.reservations.length ?? 1;
          await removeBookingAtIndex(
            selectedTable.tableId,
            index,
            `${selectedTable.toldoName} · Mesa ${selectedTable.tableNumber}`
          );
          if (prevCount <= 1) {
            setSelectedTable(null);
          }
        }}
        onFreeAll={async () => {
          if (!selectedTable || !canEditExisting) return;
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
          if (!canResetAll) return;
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
