import { useMemo, useState } from 'react';
import { ArrowUpDown, Search, X } from 'lucide-react';
import {
  AssignmentsMap,
  SEATING_TOLDOS,
  StatusFilter,
  TAG_LABELS,
  TableAssignment,
  TableSelection,
  buildTableId,
  formatRemainingSeats,
  getRemainingSeats,
  getTableBookings,
  hasVipOrHonorBooking,
} from '../types/seating';

interface GuestsListViewProps {
  assignments: AssignmentsMap;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onSelectTable: (selection: TableSelection) => void;
  onBackToPlan: () => void;
}

interface GuestRow {
  tableId: string;
  toldoId: number;
  toldoOrder: number;
  toldoName: string;
  tableNumber: number;
  assignment: TableAssignment;
}

type SortKey = 'toldo' | 'guestName' | 'guestsCount' | 'remaining' | 'tag';

export function GuestsListView({
  assignments,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onSelectTable,
  onBackToPlan,
}: GuestsListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('toldo');
  const [sortAsc, setSortAsc] = useState(true);

  const allAssignedRows = useMemo<GuestRow[]>(() => {
    const rows: GuestRow[] = [];
    SEATING_TOLDOS.forEach((toldo, orderIdx) => {
      const count = toldo.mesas ?? 15;
      for (let i = 1; i <= count; i++) {
        const tableId = buildTableId(toldo.id, i);
        const assignment = assignments[tableId];
        if (assignment) {
          rows.push({
            tableId,
            toldoId: toldo.id,
            toldoOrder: orderIdx,
            toldoName: toldo.name,
            tableNumber: i,
            assignment,
          });
        }
      }
    });
    return rows;
  }, [assignments]);

  const filteredAndSortedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = allAssignedRows.filter((row) => {
      const isVip = hasVipOrHonorBooking(row.assignment);
      const remaining = getRemainingSeats(row.assignment.guestsCount);
      if (statusFilter === 'vip' && !isVip) return false;
      if (statusFilter === 'sobrantes' && remaining <= 0) return false;
      if (statusFilter === 'libres') return false;

      if (!q) return true;
      const bookings = getTableBookings(row.assignment);
      const haystack = [
        row.toldoName,
        `m${row.tableNumber}`,
        `mesa ${row.tableNumber}`,
        bookings.length > 1 ? 'compartida' : '',
        row.assignment.guestName,
        ...bookings.flatMap((b) => [b.guestName, TAG_LABELS[b.tag], b.notes]),
        row.assignment.notes,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'toldo') {
        cmp = a.toldoOrder - b.toldoOrder || a.tableNumber - b.tableNumber;
      } else if (sortKey === 'guestName') {
        cmp = a.assignment.guestName.localeCompare(
          b.assignment.guestName,
          'es'
        );
      } else if (sortKey === 'guestsCount') {
        cmp = a.assignment.guestsCount - b.assignment.guestsCount;
      } else if (sortKey === 'remaining') {
        cmp =
          getRemainingSeats(a.assignment.guestsCount) -
          getRemainingSeats(b.assignment.guestsCount);
      } else if (sortKey === 'tag') {
        cmp = TAG_LABELS[a.assignment.tag].localeCompare(
          TAG_LABELS[b.assignment.tag],
          'es'
        );
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [allAssignedRows, searchQuery, statusFilter, sortKey, sortAsc]);

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(nextKey);
      setSortAsc(true);
    }
  }

  const totalGuestsShown = useMemo(
    () =>
      filteredAndSortedRows.reduce(
        (sum, r) => sum + r.assignment.guestsCount,
        0
      ),
    [filteredAndSortedRows]
  );

  const totalSpareShown = useMemo(
    () =>
      filteredAndSortedRows.reduce(
        (sum, r) => sum + getRemainingSeats(r.assignment.guestsCount),
        0
      ),
    [filteredAndSortedRows]
  );

  return (
    <div>
      <section className="bg-[#FBF9F5]/95 backdrop-blur-md border border-[#C9A959]/45 rounded-xl px-5 py-5 sm:px-7 sm:py-6 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.65)] flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1F2421] tracking-tight">
            Directorio de Invitados
          </h1>
          <p className="mt-2 text-sm text-[#5C635E]">
            <span className="font-mono tabular-nums text-[#1F2421] font-medium">
              {filteredAndSortedRows.length}
            </span>{' '}
            {filteredAndSortedRows.length === 1
              ? 'mesa reservada'
              : 'mesas reservadas'}{' '}
            <span aria-hidden="true" className="text-[#C9A959] mx-1">
              ·
            </span>{' '}
            <span className="font-mono tabular-nums text-[#1F2421] font-medium">
              {totalGuestsShown.toLocaleString('es-ES')}
            </span>{' '}
            sillas ocupadas{' '}
            <span aria-hidden="true" className="text-[#C9A959] mx-1">
              ·
            </span>{' '}
            <span className="font-mono tabular-nums text-[#B59449] font-medium">
              {totalSpareShown.toLocaleString('es-ES')}
            </span>{' '}
            sillas sobrantes
          </p>
        </div>

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
              placeholder="Buscar familia, mesa o nota..."
              aria-label="Buscar familia, mesa o nota"
              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-[#E4DCCE] rounded-lg text-[#1F2421] placeholder:text-[#5C635E]/70 focus:outline-none focus:ring-2 focus:ring-[#0F6B4E]/25 focus:border-[#0F6B4E]"
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
            aria-label="Filtrar lista"
            className="inline-flex p-1 bg-[#F3EFE6] border border-[#E4DCCE] rounded-lg overflow-x-auto no-scrollbar"
          >
            <button
              type="button"
              onClick={() => onStatusFilterChange('todas')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                statusFilter !== 'vip' && statusFilter !== 'sobrantes'
                  ? 'bg-white text-[#1F2421] shadow-xs'
                  : 'text-[#5C635E] hover:text-[#1F2421]'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => onStatusFilterChange('sobrantes')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                statusFilter === 'sobrantes'
                  ? 'bg-white text-[#1F2421] shadow-xs'
                  : 'text-[#5C635E] hover:text-[#1F2421]'
              }`}
            >
              Con sobrantes
            </button>
            <button
              type="button"
              onClick={() => onStatusFilterChange('vip')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                statusFilter === 'vip'
                  ? 'bg-white text-[#1F2421] shadow-xs'
                  : 'text-[#5C635E] hover:text-[#1F2421]'
              }`}
            >
              Solo VIP / Honor
            </button>
          </div>
        </div>
      </section>

      {allAssignedRows.length === 0 ? (
        <div className="mt-6 bg-white/95 backdrop-blur-[2px] border border-[#C9A959]/45 rounded-xl px-6 py-14 text-center shadow-[0_12px_32px_-16px_rgba(0,0,0,0.65)]">
          <h2 className="font-display text-2xl font-bold text-[#1F2421]">
            Aún no hay mesas asignadas
          </h2>
          <p className="mt-2 text-sm text-[#5C635E] max-w-md mx-auto">
            Selecciona cualquier mesa en el croquis para registrar el nombre de
            la familia o invitado, su número de comensales y notas especiales.
          </p>
          <button
            type="button"
            onClick={onBackToPlan}
            className="mt-6 px-5 py-2.5 text-sm font-semibold text-white bg-[#0F6B4E] hover:bg-[#0B533C] rounded-lg transition-colors whitespace-nowrap"
          >
            Ir al croquis de mesas
          </button>
        </div>
      ) : filteredAndSortedRows.length === 0 ? (
        <div className="mt-6 bg-white/95 backdrop-blur-[2px] border border-[#C9A959]/45 rounded-xl px-6 py-12 text-center shadow-[0_12px_32px_-16px_rgba(0,0,0,0.65)]">
          <h2 className="font-display text-2xl font-bold text-[#1F2421]">
            Sin coincidencias
          </h2>
          <p className="mt-2 text-sm text-[#5C635E]">
            No se encontraron mesas asignadas que coincidan con tu búsqueda o
            filtro.
          </p>
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              onStatusFilterChange('todas');
            }}
            className="mt-5 px-4 py-2 text-xs font-semibold text-[#0F6B4E] border border-[#0F6B4E] hover:bg-[#0F6B4E]/5 rounded-lg transition-colors"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="mt-6 bg-white/95 backdrop-blur-[2px] border border-[#C9A959]/45 rounded-xl overflow-hidden shadow-[0_12px_32px_-16px_rgba(0,0,0,0.65)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F3EFE6] border-b border-[#E4DCCE] text-xs font-semibold text-[#5C635E]">
                  <th className="py-3 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('toldo')}
                      className="inline-flex items-center gap-1.5 hover:text-[#1F2421] transition-colors"
                    >
                      Ubicación
                      <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('guestName')}
                      className="inline-flex items-center gap-1.5 hover:text-[#1F2421] transition-colors"
                    >
                      Invitado o Familia
                      <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('tag')}
                      className="inline-flex items-center gap-1.5 hover:text-[#1F2421] transition-colors"
                    >
                      Etiqueta
                      <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('guestsCount')}
                      className="inline-flex items-center gap-1.5 hover:text-[#1F2421] transition-colors ml-auto"
                    >
                      Sillas ocupadas
                      <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('remaining')}
                      className="inline-flex items-center gap-1.5 hover:text-[#1F2421] transition-colors ml-auto"
                    >
                      Sillas sobrantes
                      <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">Notas</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap no-print">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4DCCE]/70 text-sm">
                {filteredAndSortedRows.map((row) => {
                  const isVip = hasVipOrHonorBooking(row.assignment);
                  const bookings = getTableBookings(row.assignment);
                  const rem = getRemainingSeats(row.assignment.guestsCount);
                  return (
                    <tr
                      key={row.tableId}
                      onClick={() =>
                        onSelectTable({
                          tableId: row.tableId,
                          toldoId: row.toldoId,
                          toldoName: row.toldoName,
                          tableNumber: row.tableNumber,
                        })
                      }
                      className="hover:bg-[#FBF9F5] cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-[#1F2421]">
                          {row.toldoName}
                        </span>
                        <span
                          aria-hidden="true"
                          className="mx-1.5 text-[#C9A959]"
                        >
                          ·
                        </span>
                        <span className="font-mono tabular-nums text-xs text-[#5C635E]">
                          Mesa {row.tableNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#1F2421]">
                        {bookings.length > 1 ? (
                          <div className="space-y-0.5">
                            {bookings.map((b, idx) => (
                              <div key={`${b.guestName}-${idx}`} className="text-sm">
                                <span>{b.guestName}</span>
                                <span className="ml-1.5 font-mono tabular-nums text-xs font-medium text-[#0F6B4E]">
                                  ({b.guestsCount} {b.guestsCount === 1 ? 'silla' : 'sillas'})
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          row.assignment.guestName
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-medium ${
                            isVip ? 'text-[#B59449]' : 'text-[#5C635E]'
                          }`}
                        >
                          {TAG_LABELS[row.assignment.tag]}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#1F2421] whitespace-nowrap">
                        {row.assignment.guestsCount} / 10
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span
                          className={
                            rem > 0
                              ? 'font-semibold text-[#B59449]'
                              : 'text-[#5C635E]'
                          }
                        >
                          {rem > 0 ? formatRemainingSeats(rem) : '0 (Completa)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-[#5C635E] max-w-xs truncate">
                        {row.assignment.notes || '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap no-print">
                        <span className="text-xs font-semibold text-[#0F6B4E] hover:underline underline-offset-4">
                          {rem > 0 ? 'Completar / Editar' : 'Ver / Editar'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
