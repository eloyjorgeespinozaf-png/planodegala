import { Lock, Trash2 } from 'lucide-react';
import { ToldoStats } from '../hooks/useSeatingStore';

interface SummaryViewProps {
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
  canResetAll?: boolean;
  saving?: boolean;
  onJumpToToldo: (toldoId: number) => void;
  onRequestReset: () => void;
  onOpenControlPanel?: () => void;
}

export function SummaryView({
  toldoStats,
  totals,
  canResetAll = true,
  saving = false,
  onJumpToToldo,
  onRequestReset,
  onOpenControlPanel,
}: SummaryViewProps) {
  return (
    <div>
      <section className="bg-[#FBF9F5]/95 backdrop-blur-md border border-[#C9A959]/45 rounded-xl px-5 py-5 sm:px-7 sm:py-6 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.65)] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1F2421] tracking-tight">
            Resumen por Toldo
          </h1>
          <p className="mt-2 text-sm text-[#5C635E]">
            Ocupación global:{' '}
            <span className="font-mono tabular-nums font-semibold text-[#0F6B4E]">
              {totals.occupancyRate}%
            </span>{' '}
            <span aria-hidden="true" className="text-[#C9A959] mx-1">
              ·
            </span>{' '}
            <span className="font-mono tabular-nums text-[#1F2421] font-medium">
              {totals.freeTables}
            </span>{' '}
            mesas disponibles de{' '}
            <span className="font-mono tabular-nums text-[#1F2421] font-medium">
              {totals.totalTables}
            </span>
          </p>
        </div>

        {canResetAll ? (
          <button
            type="button"
            disabled={totals.occupiedTables === 0 || saving}
            onClick={onRequestReset}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 no-print"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Limpiar todas las asignaciones</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenControlPanel}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-[#1F2421] bg-white border border-[#C9A959]/70 hover:bg-[#F3EFE6] rounded-lg transition-colors whitespace-nowrap shrink-0 no-print"
          >
            <Lock className="w-3.5 h-3.5 text-[#B59449]" aria-hidden="true" />
            <span>Gestionar desde Panel de Control</span>
          </button>
        )}
      </section>

      <div className="mt-6 bg-white/95 backdrop-blur-[2px] border border-[#C9A959]/45 rounded-xl overflow-hidden shadow-[0_12px_32px_-16px_rgba(0,0,0,0.65)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F3EFE6] border-b border-[#E4DCCE] text-xs font-semibold text-[#5C635E]">
                <th className="py-3.5 px-5 whitespace-nowrap">Toldo</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">
                  Mesas ocupadas
                </th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">
                  Disponibles
                </th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">
                  Sillas ocupadas
                </th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">
                  Sillas sobrantes
                </th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">
                  VIP / Honor
                </th>
                <th className="py-3.5 px-5 whitespace-nowrap w-56">
                  Ocupación
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4DCCE]/70 text-sm">
              {toldoStats.map((stat) => (
                <tr
                  key={stat.toldoId}
                  onClick={() => onJumpToToldo(stat.toldoId)}
                  className="hover:bg-[#FBF9F5] cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-5 font-semibold text-[#1F2421] whitespace-nowrap">
                    {stat.toldoName}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#0F6B4E] font-medium whitespace-nowrap">
                    {stat.occupiedTables} / {stat.totalTables}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#5C635E] whitespace-nowrap">
                    {stat.freeTables}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#1F2421] whitespace-nowrap">
                    {stat.assignedGuests.toLocaleString('es-ES')} /{' '}
                    {stat.capacity.toLocaleString('es-ES')}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#B59449] font-medium whitespace-nowrap">
                    {stat.spareSeatsInReserved.toLocaleString('es-ES')}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#5C635E] whitespace-nowrap">
                    {stat.vipTables}
                  </td>
                  <td className="py-3.5 px-5 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-[#F3EFE6] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0F6B4E] transition-all duration-200"
                          style={{ width: `${stat.occupancyRate}%` }}
                        />
                      </div>
                      <span className="font-mono tabular-nums text-xs text-[#5C635E] w-9 text-right">
                        {stat.occupancyRate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#FBF9F5] border-t border-[#E4DCCE] text-sm font-semibold text-[#1F2421]">
                <td className="py-3.5 px-5 whitespace-nowrap">
                  Total salón (7 toldos + Pista T4)
                </td>
                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#0F6B4E] whitespace-nowrap">
                  {totals.occupiedTables} / {totals.totalTables}
                </td>
                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#5C635E] whitespace-nowrap">
                  {totals.freeTables}
                </td>
                <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                  {totals.assignedGuests.toLocaleString('es-ES')} /{' '}
                  {totals.totalCapacity.toLocaleString('es-ES')}
                </td>
                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#B59449] whitespace-nowrap">
                  {totals.spareSeatsInReserved.toLocaleString('es-ES')}
                </td>
                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#5C635E] whitespace-nowrap">
                  {totals.vipTables}
                </td>
                <td className="py-3.5 px-5 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-[#E4DCCE] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0F6B4E]"
                        style={{ width: `${totals.occupancyRate}%` }}
                      />
                    </div>
                    <span className="font-mono tabular-nums text-xs text-[#1F2421] w-9 text-right">
                      {totals.occupancyRate}%
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-[#F3EFE6]/85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
        Sincronizado en tiempo real con Firebase Firestore. Haz clic en
        cualquier fila para ir directamente a ese toldo en el plano.
      </p>
    </div>
  );
}
