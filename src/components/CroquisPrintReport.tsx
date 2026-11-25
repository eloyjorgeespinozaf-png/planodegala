import croquisHdImg from '../assets/images/croquis_salon_hd_1795641348750.jpg';
import { ToldoStats } from '../hooks/useSeatingStore';
import {
  AssignmentsMap,
  SEATS_PER_TABLE,
  TAG_LABELS,
  TOLDOS_CONFIG,
  TableAssignment,
  buildTableId,
  formatRemainingSeats,
  formatSharedOccupantsSummary,
  getRemainingSeats,
  getTableBookings,
  hasVipOrHonorBooking,
} from '../types/seating';
import {
  TABLE_SLOTS,
  TOLDO_BANDS,
  getShortTableLabel,
} from '../utils/croquisLayout';

interface CroquisPrintReportProps {
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
}

const BRAND_IMAGE_SRC = '/assets/aistudio/image_b65aae5b.png';

function formatPrintDate(date: Date): string {
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPrintCompactName(entry: TableAssignment, maxLen: number): string {
  const bookings = getTableBookings(entry);
  if (bookings.length <= 1) {
    return getShortTableLabel(entry.guestName, maxLen);
  }
  const suffix = ` +${bookings.length - 1}`;
  return `${getShortTableLabel(bookings[0].guestName, Math.max(6, maxLen - suffix.length))}${suffix}`;
}

function PrintRoundMarker({
  tableNumber,
  entry,
}: {
  tableNumber: number;
  entry?: TableAssignment;
}) {
  const isOccupied = Boolean(entry);
  const isVip = hasVipOrHonorBooking(entry);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div
        className={`w-full h-full rounded-full flex flex-col items-center justify-center leading-none border ${
          isOccupied
            ? isVip
              ? 'bg-[#0F6B4E] text-white border-[#B59449] border-2'
              : 'bg-[#0F6B4E] text-white border-[#D4B45E] border-[1.5px]'
            : 'bg-white/90 text-[#1F2421] border-[#B59449]'
        }`}
      >
        <span className="font-mono tabular-nums font-bold text-[7.5px] leading-none">
          M{tableNumber}
        </span>
        {isOccupied && entry && (
          <span className="font-mono tabular-nums font-semibold text-[6.5px] text-[#F5E09D] leading-none mt-[1px]">
            {entry.guestsCount}/10
          </span>
        )}
      </div>

      {isOccupied && entry && (
        <div className="absolute top-[102%] left-1/2 -translate-x-1/2 bg-white/95 border border-[#0F6B4E]/80 rounded-[3px] px-1 py-[1px] max-w-[76px] shadow-xs z-20">
          <div className="text-[6.2px] leading-[1.1] font-semibold text-[#1F2421] truncate text-center">
            {getPrintCompactName(entry, 14)}
          </div>
        </div>
      )}
    </div>
  );
}

function PrintRectMarker({
  tableNumber,
  entry,
}: {
  tableNumber: number;
  entry?: TableAssignment;
}) {
  const isOccupied = Boolean(entry);
  const isVip = hasVipOrHonorBooking(entry);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div
        className={`w-full h-full rounded-[4px] px-0.5 flex flex-col items-center justify-center leading-none border ${
          isOccupied
            ? isVip
              ? 'bg-[#0F6B4E] text-white border-[#B59449] border-2'
              : 'bg-[#0F6B4E] text-white border-[#D4B45E] border-[1.5px]'
            : 'bg-white/90 text-[#1F2421] border-[#B59449]'
        }`}
      >
        <span className="font-mono tabular-nums font-bold text-[7.5px] leading-none">
          M{tableNumber}
          {isOccupied && entry ? ` · ${entry.guestsCount}/10` : ''}
        </span>
        {isOccupied && entry && (
          <span className="text-[6.2px] font-semibold text-[#F5E09D] leading-[1.1] mt-[1px] max-w-full truncate">
            {getPrintCompactName(entry, 15)}
          </span>
        )}
      </div>
    </div>
  );
}

export function CroquisPrintReport({
  assignments,
  toldoStats,
  totals,
}: CroquisPrintReportProps) {
  const statsByToldo = new Map<number, ToldoStats>();
  for (const stat of toldoStats) {
    statsByToldo.set(stat.toldoId, stat);
  }

  const slotShapeMap = new Map<number, 'round' | 'rect'>();
  for (const slot of TABLE_SLOTS) {
    slotShapeMap.set(slot.tableNumber, slot.shape);
  }

  const printedAt = formatPrintDate(new Date());

  return (
    <div className="hidden print:block text-[#1F2421] bg-white">
      {/* ==================== PAGE 1: VISUAL CROQUIS + GLOBAL TOTALS ==================== */}
      <section className="print-avoid-break">
        {/* Ceremonial Print Header */}
        <div className="flex items-center justify-between gap-4 pb-2.5 border-b-2 border-[#B59449]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-10 overflow-hidden rounded border border-[#B59449] bg-[#0E0B07] shrink-0">
              <img
                src={BRAND_IMAGE_SRC}
                alt="Acto de Egreso"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-[50%_46%] scale-[1.18]"
              />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-[#1F2421] leading-tight">
                Croquis General del Salón — Distribución de Mesas
              </h1>
              <p className="text-[11px] text-[#5C635E]">
                7 toldos de comensales (105 mesas · 10 sillas por mesa) y pista
                de baile (Toldo 4) · Dimensiones 16,00 m × 64,00 m
              </p>
            </div>
          </div>

          <div className="text-right text-[10px] text-[#5C635E] shrink-0">
            <div className="font-semibold text-[#1F2421]">
              Reporte Oficial de Distribución
            </div>
            <div className="font-mono tabular-nums mt-0.5">
              Impreso: {printedAt}
            </div>
          </div>
        </div>

        {/* Global Totals Strip */}
        <div className="mt-2.5 grid grid-cols-5 border border-[#D9CEBC] rounded-lg divide-x divide-[#D9CEBC] bg-[#FBF9F5]">
          <div className="px-3 py-1.5">
            <div className="text-[9.5px] font-medium text-[#5C635E]">
              Mesas ocupadas
            </div>
            <div className="font-mono tabular-nums text-sm font-bold text-[#0F6B4E]">
              {totals.occupiedTables} / {totals.totalTables}{' '}
              <span className="text-[10px] font-semibold text-[#5C635E]">
                ({totals.occupancyRate}%)
              </span>
            </div>
          </div>
          <div className="px-3 py-1.5">
            <div className="text-[9.5px] font-medium text-[#5C635E]">
              Mesas libres
            </div>
            <div className="font-mono tabular-nums text-sm font-bold text-[#1F2421]">
              {totals.freeTables}
            </div>
          </div>
          <div className="px-3 py-1.5">
            <div className="text-[9.5px] font-medium text-[#5C635E]">
              Comensales (sillas ocup.)
            </div>
            <div className="font-mono tabular-nums text-sm font-bold text-[#1F2421]">
              {totals.assignedGuests.toLocaleString('es-ES')} /{' '}
              {totals.totalCapacity.toLocaleString('es-ES')}
            </div>
          </div>
          <div className="px-3 py-1.5">
            <div className="text-[9.5px] font-medium text-[#5C635E]">
              Sillas sobrantes (reservadas)
            </div>
            <div className="font-mono tabular-nums text-sm font-bold text-[#B59449]">
              {totals.spareSeatsInReserved.toLocaleString('es-ES')}
            </div>
          </div>
          <div className="px-3 py-1.5">
            <div className="text-[9.5px] font-medium text-[#5C635E]">
              Mesas VIP / Honor
            </div>
            <div className="font-mono tabular-nums text-sm font-bold text-[#1F2421]">
              {totals.vipTables}
            </div>
          </div>
        </div>

        {/* Full-clarity HD Visual Croquis with Explicit Names & Occupancy */}
        <div className="mt-2.5 flex justify-center">
          <div className="relative w-full max-w-[205mm] aspect-[1200/896] border border-[#C9A959] rounded-md overflow-hidden bg-[#EFE7DB]">
            <img
              src={croquisHdImg}
              alt="Croquis arquitectónico del salón"
              referrerPolicy="no-referrer"
              className="w-full h-full object-fill block"
            />

            {/* Per-Toldo occupancy overlay next to each left Toldo label */}
            {TOLDO_BANDS.map((band) => {
              const stat = statsByToldo.get(band.toldoId);
              if (!stat) return null;
              return (
                <div
                  key={`print-toldo-${band.toldoId}`}
                  style={{
                    top: `${band.topPct + band.heightPct * 0.88}%`,
                    left: '7.8%',
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 bg-[#0F6B4E] text-white border border-[#F1D68A] rounded px-1.5 py-[1px] font-mono tabular-nums text-[7.5px] font-semibold whitespace-nowrap z-10"
                >
                  {stat.occupiedTables}/15 · {stat.assignedGuests} pers.
                </div>
              );
            })}

            {/* Every table overlaid with authentic shape + explicit guest name & count */}
            {TOLDO_BANDS.map((band) =>
              TABLE_SLOTS.map((slot) => {
                const tableId = buildTableId(band.toldoId, slot.tableNumber);
                const entry = assignments[tableId];
                const yPct = band.topPct + band.heightPct * slot.yOffsetRatio;
                const sizeClass =
                  slot.shape === 'round'
                    ? slot.tableNumber === 15
                      ? 'w-[4.15%] aspect-square'
                      : 'w-[5.1%] aspect-square'
                    : 'w-[7.5%] aspect-[106/54]';

                return (
                  <div
                    key={`print-slot-${tableId}`}
                    style={{
                      left: `${slot.xPct}%`,
                      top: `${yPct}%`,
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 ${sizeClass} ${
                      entry ? 'z-20' : 'z-10'
                    }`}
                  >
                    {slot.shape === 'round' ? (
                      <PrintRoundMarker
                        tableNumber={slot.tableNumber}
                        entry={entry}
                      />
                    ) : (
                      <PrintRectMarker
                        tableNumber={slot.tableNumber}
                        entry={entry}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Visual Legend */}
        <div className="mt-2 flex items-center justify-between text-[9.5px] text-[#5C635E]">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#0F6B4E] border border-[#D4B45E]" />
              Mesa redonda ocupada (código, ocupantes y titular)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-2 rounded-[2px] bg-[#0F6B4E] border border-[#D4B45E]" />
              Mesa rectangular ocupada
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-white border border-[#B59449]" />
              Mesa libre (10 sillas disponibles)
            </span>
          </div>
          <span className="font-medium text-[#1F2421]">
            Ver detalle nominal completo por toldo en las páginas siguientes →
          </span>
        </div>
      </section>

      {/* ==================== PAGE 2+: EXPLICIT TABLE-BY-TABLE DETAIL PER TOLDO ==================== */}
      <section className="print-break-before">
        <div className="flex items-baseline justify-between pb-2 border-b-2 border-[#B59449]">
          <div>
            <h2 className="font-display text-xl font-bold text-[#1F2421]">
              Detalle Nominal de Mesas por Toldo
            </h2>
            <p className="text-[10.5px] text-[#5C635E]">
              Relación completa de las 105 mesas: titular asignado, cantidad de
              ocupantes (de 10 sillas), sillas sobrantes y subtotales por toldo.
            </p>
          </div>
          <div className="font-mono tabular-nums text-[10px] text-[#5C635E]">
            Total ocupadas: <strong className="text-[#0F6B4E]">{totals.occupiedTables}/{totals.totalTables}</strong> · Comensales:{' '}
            <strong className="text-[#1F2421]">{totals.assignedGuests}</strong>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {TOLDOS_CONFIG.map((toldo) => {
            if (toldo.type === 'pista') {
              return (
                <div
                  key={toldo.id}
                  className="print-avoid-break border border-[#D4B45E] bg-[#FBF9F5] rounded-md px-3.5 py-2 flex items-center justify-between text-xs"
                >
                  <div className="font-semibold text-[#1F2421]">
                    TOLDO 4 — PISTA DE BAILE
                  </div>
                  <div className="text-[#5C635E]">
                    Área central para escenario, grupo musical y baile (sin
                    mesas de comensales)
                  </div>
                </div>
              );
            }

            const stat = statsByToldo.get(toldo.id);
            const tableCount = toldo.mesas ?? 15;

            return (
              <div
                key={toldo.id}
                className="print-avoid-break border border-[#D9CEBC] rounded-md overflow-hidden"
              >
                {/* Toldo Subheader with Per-Toldo Totals */}
                <div className="bg-[#F3EFE6] border-b border-[#D9CEBC] px-3 py-1.5 flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1F2421]">
                      {toldo.name}
                    </span>
                    <span className="text-[#5C635E]">
                      ({tableCount} mesas · {tableCount * SEATS_PER_TABLE} sillas)
                    </span>
                  </div>

                  {stat && (
                    <div className="flex items-center gap-3 font-mono tabular-nums text-[10px]">
                      <span className="text-[#0F6B4E] font-semibold">
                        Ocupadas: {stat.occupiedTables}/{stat.totalTables}
                      </span>
                      <span className="text-[#5C635E]">
                        Libres: {stat.freeTables}
                      </span>
                      <span className="text-[#1F2421] font-semibold">
                        Comensales: {stat.assignedGuests}/{stat.capacity}
                      </span>
                      <span className="text-[#8E6D24] font-semibold">
                        Sobrantes: {stat.spareSeatsInReserved}
                      </span>
                      <span className="text-[#1F2421] font-semibold">
                        {stat.occupancyRate}%
                      </span>
                    </div>
                  )}
                </div>

                {/* 15 Tables in a 3-column × 5-row structured ledger */}
                <div className="grid grid-cols-3 divide-x divide-[#E4DCCE] bg-white">
                  {[0, 1, 2].map((colIdx) => {
                    const start = colIdx * 5 + 1;
                    const end = Math.min(tableCount, start + 4);
                    const nums = Array.from(
                      { length: end - start + 1 },
                      (_, i) => start + i
                    );

                    return (
                      <div key={colIdx} className="divide-y divide-[#EFE8DC]">
                        {nums.map((tableNum) => {
                          const tableId = buildTableId(toldo.id, tableNum);
                          const entry = assignments[tableId];
                          const shape = slotShapeMap.get(tableNum) ?? 'round';
                          const remaining = entry
                            ? getRemainingSeats(entry.guestsCount)
                            : SEATS_PER_TABLE;
                          const isVip =
                            entry?.tag === 'vip' || entry?.tag === 'honor';

                          return (
                            <div
                              key={tableId}
                              className={`px-2.5 py-1.5 flex items-center justify-between gap-2 text-[10px] ${
                                entry ? 'bg-[#F5FBF8]' : 'bg-white'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-1.5">
                                  <span
                                    className={`font-mono tabular-nums font-bold shrink-0 ${
                                      entry
                                        ? 'text-[#0F6B4E]'
                                        : 'text-[#7C827E]'
                                    }`}
                                  >
                                    M{tableNum}
                                  </span>
                                  <span className="text-[8.5px] text-[#7C827E] shrink-0">
                                    ({shape === 'round' ? 'Red.' : 'Rect.'})
                                  </span>
                                  {entry ? (
                                    <span className="font-semibold text-[#1F2421] break-words leading-snug">
                                      {formatSharedOccupantsSummary(entry)}
                                    </span>
                                  ) : (
                                    <span className="italic text-[#8A908C]">
                                      Disponible
                                    </span>
                                  )}
                                </div>
                                {entry &&
                                  (entry.tag !== 'estandar' || entry.notes) && (
                                    <div className="text-[8.5px] text-[#5C635E] truncate pl-6">
                                      {entry.tag !== 'estandar' && (
                                        <span
                                          className={`font-semibold ${
                                            isVip
                                              ? 'text-[#8E6D24]'
                                              : 'text-[#5C635E]'
                                          }`}
                                        >
                                          {TAG_LABELS[entry.tag]}
                                        </span>
                                      )}
                                      {entry.tag !== 'estandar' && entry.notes
                                        ? ' · '
                                        : ''}
                                      {entry.notes}
                                    </div>
                                  )}
                              </div>

                              <div className="text-right shrink-0 font-mono tabular-nums leading-tight">
                                {entry ? (
                                  <>
                                    <div className="font-bold text-[#0F6B4E]">
                                      {entry.guestsCount}/10
                                    </div>
                                    <div
                                      className={`text-[8.5px] ${
                                        remaining > 0
                                          ? 'text-[#8E6D24] font-semibold'
                                          : 'text-[#5C635E]'
                                      }`}
                                    >
                                      {formatRemainingSeats(remaining)}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-[#8A908C]">0/10</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ==================== GRAND TOTALS SUMMARY TABLE ==================== */}
        <div className="mt-4 print-avoid-break border border-[#B59449] rounded-md overflow-hidden">
          <div className="bg-[#1F2421] text-white px-3.5 py-2 flex items-center justify-between">
            <h3 className="font-display text-base font-bold">
              Cuadro Resumen de Totales por Toldo y Total General
            </h3>
            <span className="font-mono tabular-nums text-[10px] text-[#F1D68A]">
              Ocupación global: {totals.occupancyRate}%
            </span>
          </div>

          <table className="w-full text-left border-collapse text-[10.5px]">
            <thead>
              <tr className="bg-[#F3EFE6] border-b border-[#D9CEBC] text-[#5C635E] font-semibold">
                <th className="py-1.5 px-3">Toldo</th>
                <th className="py-1.5 px-3 text-right">Mesas ocupadas</th>
                <th className="py-1.5 px-3 text-right">Mesas libres</th>
                <th className="py-1.5 px-3 text-right">Comensales</th>
                <th className="py-1.5 px-3 text-right">Capacidad</th>
                <th className="py-1.5 px-3 text-right">Sillas sobrantes</th>
                <th className="py-1.5 px-3 text-right">VIP / Honor</th>
                <th className="py-1.5 px-3 text-right">% Ocupación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4DCCE]">
              {toldoStats.map((stat) => (
                <tr key={`total-row-${stat.toldoId}`}>
                  <td className="py-1.5 px-3 font-semibold text-[#1F2421]">
                    {stat.toldoName}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono tabular-nums font-semibold text-[#0F6B4E]">
                    {stat.occupiedTables} / {stat.totalTables}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono tabular-nums text-[#5C635E]">
                    {stat.freeTables}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono tabular-nums font-semibold text-[#1F2421]">
                    {stat.assignedGuests.toLocaleString('es-ES')}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono tabular-nums text-[#5C635E]">
                    {stat.capacity.toLocaleString('es-ES')}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono tabular-nums font-semibold text-[#8E6D24]">
                    {stat.spareSeatsInReserved.toLocaleString('es-ES')}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono tabular-nums text-[#5C635E]">
                    {stat.vipTables}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono tabular-nums font-semibold text-[#1F2421]">
                    {stat.occupancyRate}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#FBF9F5] border-t-2 border-[#B59449] font-bold text-[#1F2421]">
                <td className="py-2 px-3">
                  TOTAL GENERAL (7 toldos + Pista T4)
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-[#0F6B4E]">
                  {totals.occupiedTables} / {totals.totalTables}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums">
                  {totals.freeTables}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums">
                  {totals.assignedGuests.toLocaleString('es-ES')}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums">
                  {totals.totalCapacity.toLocaleString('es-ES')}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-[#8E6D24]">
                  {totals.spareSeatsInReserved.toLocaleString('es-ES')}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums">
                  {totals.vipTables}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-[#0F6B4E]">
                  {totals.occupancyRate}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
