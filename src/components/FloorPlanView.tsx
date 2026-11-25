import { useMemo } from 'react';
import { Search, X } from 'lucide-react';
import {
  AssignmentsMap,
  StatusFilter,
  TAG_LABELS,
  TOLDOS_CONFIG,
  TableSelection,
  buildTableId,
  getRemainingSeats,
} from '../types/seating';
import { ToldoStats } from '../hooks/useSeatingStore';
import { DanceFloorToldo } from './DanceFloorToldo';
import { TableNode } from './TableNode';

interface FloorPlanViewProps {
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
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onSelectTable: (selection: TableSelection) => void;
}

const FILTER_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'libres', label: 'Disponibles' },
  { id: 'ocupadas', label: 'Ocupadas' },
  { id: 'sobrantes', label: 'Con sobrantes' },
  { id: 'vip', label: 'VIP' },
];

export function FloorPlanView({
  assignments,
  toldoStats,
  totals,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onSelectTable,
}: FloorPlanViewProps) {
  const statsByToldoId = useMemo(() => {
    const map = new Map<number, ToldoStats>();
    for (const stat of toldoStats) {
      map.set(stat.toldoId, stat);
    }
    return map;
  }, [toldoStats]);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const hasActiveFilter = trimmedQuery.length > 0 || statusFilter !== 'todas';

  const matchingTableIds = useMemo(() => {
    const matches = new Set<string>();
    for (const toldo of TOLDOS_CONFIG) {
      if (toldo.type !== 'mesas') continue;
      const count = toldo.mesas ?? 15;
      for (let i = 1; i <= count; i++) {
        const tableId = buildTableId(toldo.id, i);
        const entry = assignments[tableId];
        const isOccupied = Boolean(entry);
        const hasSpareSeats =
          isOccupied && getRemainingSeats(entry!.guestsCount) > 0;
        const isVip =
          isOccupied && (entry?.tag === 'vip' || entry?.tag === 'honor');

        if (statusFilter === 'libres' && isOccupied) continue;
        if (statusFilter === 'ocupadas' && !isOccupied) continue;
        if (statusFilter === 'sobrantes' && !hasSpareSeats) continue;
        if (statusFilter === 'vip' && !isVip) continue;

        if (trimmedQuery) {
          const searchable = [
            toldo.name,
            `m${i}`,
            `mesa ${i}`,
            entry ? entry.guestName : 'libre',
            entry ? TAG_LABELS[entry.tag] : '',
            entry ? entry.notes : '',
          ]
            .join(' ')
            .toLowerCase();
          if (!searchable.includes(trimmedQuery)) continue;
        }

        matches.add(tableId);
      }
    }
    return matches;
  }, [assignments, statusFilter, trimmedQuery]);

  return (
    <div>
      {/* Title, tabular occupancy line & interactive toolbar */}
      <section className="bg-[#FBF9F5]/92 backdrop-blur-md border border-[#D4B45E]/65 rounded-xl px-5 py-5 sm:px-7 sm:py-6 shadow-[0_18px_42px_-14px_rgba(0,0,0,0.82)]">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1F2421] tracking-tight">
              Distribución de Mesas
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-[#5C635E]">
              <span className="font-mono tabular-nums text-[#1F2421] font-medium">
                {totals.occupiedTables} / {totals.totalTables}
              </span>
              <span>mesas ocupadas</span>
              <span aria-hidden="true" className="text-[#C9A959]">
                ·
              </span>
              <span className="font-mono tabular-nums text-[#1F2421] font-medium">
                {totals.assignedGuests.toLocaleString('es-ES')} /{' '}
                {totals.totalCapacity.toLocaleString('es-ES')}
              </span>
              <span>sillas ocupadas</span>
              <span aria-hidden="true" className="text-[#C9A959]">
                ·
              </span>
              <span className="font-mono tabular-nums text-[#B59449] font-medium">
                {totals.spareSeatsInReserved.toLocaleString('es-ES')}
              </span>
              <span>sillas sobrantes en reservadas</span>
              <span aria-hidden="true" className="text-[#C9A959]">
                ·
              </span>
              <span className="font-mono tabular-nums text-[#1F2421] font-medium">
                {totals.vipTables}
              </span>
              <span>VIP / Honor</span>
            </div>
          </div>

          {/* Search & segmented filter bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 no-print">
            <div className="relative flex-1 sm:w-64">
              <Search
                className="w-4 h-4 text-[#5C635E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar invitado, mesa o nota..."
                aria-label="Buscar invitado, mesa o nota"
                className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-[#E4DCCE] rounded-lg text-[#1F2421] placeholder:text-[#5C635E]/70 focus:outline-none focus:ring-2 focus:ring-[#0F6B4E]/25 focus:border-[#0F6B4E] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#5C635E] hover:text-[#1F2421] rounded"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <div
              role="group"
              aria-label="Filtrar mesas por estado"
              className="inline-flex p-1 bg-[#F3EFE6] border border-[#E4DCCE] rounded-lg overflow-x-auto no-scrollbar"
            >
              {FILTER_OPTIONS.map((option) => {
                const isActive = statusFilter === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onStatusFilterChange(option.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6B4E] ${
                      isActive
                        ? 'bg-white text-[#1F2421] shadow-xs'
                        : 'text-[#5C635E] hover:text-[#1F2421]'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick canopy jump links + legend */}
        <div className="mt-4 pt-4 border-t border-[#E4DCCE]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs no-print">
          <nav
            aria-label="Ir directamente a un toldo"
            className="flex items-center gap-3.5 overflow-x-auto no-scrollbar py-0.5"
          >
            <span className="text-[#5C635E] shrink-0">Ir a:</span>
            {TOLDOS_CONFIG.map((toldo) => (
              <a
                key={toldo.id}
                href={`#toldo-${toldo.id}`}
                className="text-[#1F2421] hover:text-[#0F6B4E] underline-offset-4 hover:underline transition-colors whitespace-nowrap shrink-0 font-medium"
              >
                {toldo.type === 'pista' ? 'Pista (T4)' : `Toldo ${toldo.id}`}
              </a>
            ))}
          </nav>

          {/* Compact accessible legend */}
          <div className="flex flex-wrap items-center gap-4 text-[#5C635E] shrink-0">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                aria-hidden="true"
                className="w-3 h-3 rounded-full bg-white border-2 border-[#C9A959]"
              />
              Libre (10 sillas)
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                aria-hidden="true"
                className="w-3 h-3 rounded-full bg-[#0F6B4E] border border-[#0B533C]"
              />
              Reservada
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                aria-hidden="true"
                className="w-2.5 h-2.5 rounded-xs bg-[#0F6B4E]"
              />
              Silla ocupada
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                aria-hidden="true"
                className="w-2.5 h-2.5 rounded-xs bg-white border border-[#B59449]"
              />
              Silla sobrante
            </span>
          </div>
        </div>
      </section>

      {/* Contextual filter feedback banner */}
      {hasActiveFilter && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#FBF9F5]/95 backdrop-blur-sm border border-[#C9A959]/45 rounded-lg text-xs text-[#1F2421] shadow-sm no-print">
          <span>
            {matchingTableIds.size === 0 ? (
              'Ninguna mesa coincide con el filtro o búsqueda actual.'
            ) : (
              <>
                Mostrando{' '}
                <strong className="font-mono tabular-nums">
                  {matchingTableIds.size}
                </strong>{' '}
                {matchingTableIds.size === 1
                  ? 'mesa coincidente'
                  : 'mesas coincidentes'}{' '}
                resaltadas en el plano.
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              onStatusFilterChange('todas');
            }}
            className="font-semibold text-[#0F6B4E] hover:text-[#0B533C] underline underline-offset-4 whitespace-nowrap"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* 8-Toldo Floor Plan Stack */}
      <div className="mt-6 flex flex-col gap-5">
        {TOLDOS_CONFIG.map((toldo) => {
          if (toldo.type === 'pista') {
            return <DanceFloorToldo key={toldo.id} />;
          }

          const stat = statsByToldoId.get(toldo.id);
          const mesasCount = toldo.mesas ?? 15;
          const capacity = toldo.personas ?? 150;

          return (
            <section
              key={toldo.id}
              id={`toldo-${toldo.id}`}
              aria-label={toldo.name}
              className="print-avoid-break flex flex-col md:flex-row bg-white/90 backdrop-blur-sm border border-[#D4B45E]/65 rounded-xl overflow-hidden shadow-[0_18px_42px_-14px_rgba(0,0,0,0.82)] scroll-mt-28"
            >
              {/* Left Canopy Info Panel */}
              <div className="md:w-52 bg-[#F3EFE6]/92 px-5 py-5 flex flex-row md:flex-col items-center md:items-start justify-between md:justify-center gap-2 border-b md:border-b-0 md:border-r border-[#E4DCCE] shrink-0">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#1F2421] leading-tight">
                    {toldo.name}
                  </h2>
                  <p className="mt-1 font-mono tabular-nums text-xs text-[#5C635E]">
                    {stat?.occupiedTables ?? 0} / {mesasCount} mesas
                  </p>
                  <p className="font-mono tabular-nums text-xs text-[#5C635E]">
                    {stat?.assignedGuests ?? 0} / {capacity} sillas ocup.
                  </p>
                  {(stat?.spareSeatsInReserved ?? 0) > 0 && (
                    <p className="mt-0.5 font-mono tabular-nums text-xs font-medium text-[#B59449]">
                      {stat!.spareSeatsInReserved}{' '}
                      {stat!.spareSeatsInReserved === 1
                        ? 'silla sobrante'
                        : 'sillas sobrantes'}
                    </p>
                  )}
                </div>

                {/* Subtle slim progress bar */}
                <div className="w-24 md:w-full mt-0 md:mt-3">
                  <div className="h-1.5 w-full bg-[#E4DCCE] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0F6B4E] transition-all duration-200"
                      style={{ width: `${stat?.occupancyRate ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Right 5x3 (desktop) / 3x5 (mobile) Circular Table Grid */}
              <div className="flex-1 p-4 sm:p-6 flex items-center justify-center">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-5 place-items-center w-full max-w-4xl">
                  {Array.from({ length: mesasCount }, (_, idx) => {
                    const tableNumber = idx + 1;
                    const tableId = buildTableId(toldo.id, tableNumber);
                    const assignment = assignments[tableId];
                    const isHighlighted =
                      !hasActiveFilter || matchingTableIds.has(tableId);

                    return (
                      <TableNode
                        key={tableId}
                        toldoName={toldo.name}
                        tableNumber={tableNumber}
                        assignment={assignment}
                        isHighlighted={isHighlighted}
                        onSelect={() =>
                          onSelectTable({
                            tableId,
                            toldoId: toldo.id,
                            toldoName: toldo.name,
                            tableNumber,
                          })
                        }
                      />
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
