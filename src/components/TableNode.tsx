import {
  SEATS_PER_TABLE,
  TAG_LABELS,
  TableAssignment,
  getRemainingSeats,
} from '../types/seating';

interface TableNodeProps {
  toldoName: string;
  tableNumber: number;
  assignment?: TableAssignment;
  isHighlighted: boolean;
  onSelect: () => void;
}

const CHAIR_SLOTS = Array.from({ length: SEATS_PER_TABLE }, (_, idx) => {
  const angleDeg = idx * 36 - 90;
  const angleRad = (angleDeg * Math.PI) / 180;
  const cx = Number((64 + 54.5 * Math.cos(angleRad)).toFixed(2));
  const cy = Number((64 + 54.5 * Math.sin(angleRad)).toFixed(2));
  return {
    idx,
    cx,
    cy,
    rotation: angleDeg + 90,
  };
});

export function TableNode({
  toldoName,
  tableNumber,
  assignment,
  isHighlighted,
  onSelect,
}: TableNodeProps) {
  const isOccupied = Boolean(assignment);
  const isVip =
    isOccupied && (assignment?.tag === 'vip' || assignment?.tag === 'honor');
  const occupiedChairs = isOccupied
    ? Math.min(SEATS_PER_TABLE, Math.max(0, assignment?.guestsCount ?? 0))
    : 0;
  const remainingChairs = isOccupied
    ? getRemainingSeats(occupiedChairs)
    : SEATS_PER_TABLE;

  const spareShortLabel =
    remainingChairs === 0
      ? 'Completa'
      : remainingChairs === 1
        ? '1 sobra'
        : `${remainingChairs} sobran`;

  const ariaLabel = isOccupied
    ? `${toldoName}, Mesa ${tableNumber}, reservada por ${assignment!.guestName}, ${occupiedChairs} sillas ocupadas, ${remainingChairs} sillas sobrantes de ${SEATS_PER_TABLE}, ${TAG_LABELS[assignment!.tag]}`
    : `${toldoName}, Mesa ${tableNumber}, libre con ${SEATS_PER_TABLE} sillas disponibles. Haz clic para reservar`;

  const tooltip = isOccupied
    ? `${toldoName} · Mesa ${tableNumber} — ${assignment!.guestName} (${occupiedChairs} ocupadas · ${
        remainingChairs === 0
          ? 'sin sillas sobrantes'
          : remainingChairs === 1
            ? 'sobra 1 silla'
            : `sobran ${remainingChairs} sillas`
      } · ${TAG_LABELS[assignment!.tag]})${
        assignment!.notes ? ` · Nota: ${assignment!.notes}` : ''
      }`
    : `${toldoName} · Mesa ${tableNumber} (Libre · 10 sillas disponibles)`;

  return (
    <div
      className={`relative w-[108px] h-[108px] sm:w-[120px] sm:h-[120px] flex items-center justify-center transition-opacity duration-150 ${
        isHighlighted ? 'opacity-100' : 'opacity-20 hover:opacity-80'
      }`}
    >
      {/* 10 visible chairs arranged radially around the circular table */}
      <svg
        viewBox="0 0 128 128"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        {CHAIR_SLOTS.map((slot) => {
          const isSeatOccupied = isOccupied && slot.idx < occupiedChairs;
          const fill = isSeatOccupied
            ? isVip
              ? '#B59449'
              : '#0F6B4E'
            : '#FFFFFF';
          const stroke = isSeatOccupied
            ? isVip
              ? '#8E7030'
              : '#0B533C'
            : isOccupied
              ? '#B59449'
              : '#C9A959';

          return (
            <g
              key={slot.idx}
              transform={`translate(${slot.cx} ${slot.cy}) rotate(${slot.rotation})`}
            >
              {/* Chair backrest */}
              <rect
                x="-6"
                y="-5.5"
                width="12"
                height="3.2"
                rx="1.6"
                fill={fill}
                stroke={stroke}
                strokeWidth="1.1"
              />
              {/* Chair seat cushion */}
              <rect
                x="-5"
                y="-1.5"
                width="10"
                height="5.5"
                rx="2"
                fill={fill}
                stroke={stroke}
                strokeWidth="1.1"
              />
            </g>
          );
        })}
      </svg>

      {/* Interactive circular tabletop */}
      <button
        type="button"
        onClick={onSelect}
        title={tooltip}
        aria-label={ariaLabel}
        className={`group relative z-10 w-[82px] h-[82px] sm:w-[92px] sm:h-[92px] rounded-full flex flex-col items-center justify-center px-2 text-center cursor-pointer transition-all duration-150 hover:scale-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0F6B4E] ${
          isOccupied
            ? isVip
              ? 'bg-[#0F6B4E] text-white border-2 border-[#C9A959] ring-2 ring-[#C9A959]/45 hover:bg-[#0B533C]'
              : 'bg-[#0F6B4E] text-white border-2 border-[#0B533C] hover:bg-[#0B533C]'
            : 'bg-white text-[#1F2421] border-2 border-[#C9A959] hover:border-[#B59449] hover:bg-[#FBF9F5]'
        }`}
      >
        {isOccupied && assignment ? (
          <div className="w-full flex flex-col items-center justify-center">
            <span className="font-mono tabular-nums text-[9px] sm:text-[10px] leading-none tracking-wide text-white/80">
              {isVip
                ? `M${tableNumber} · ${assignment.tag === 'honor' ? 'HONOR' : 'VIP'}`
                : `M${tableNumber}`}
            </span>
            <span className="mt-0.5 text-[11px] font-semibold leading-[1.15] line-clamp-2 break-words w-full text-white">
              {assignment.guestName}
            </span>
            <span
              className={`mt-1 font-mono tabular-nums text-[9px] sm:text-[10px] leading-none ${
                remainingChairs > 0 ? 'text-[#F3DF9E] font-medium' : 'text-white/80'
              }`}
            >
              {occupiedChairs}/10 · {spareShortLabel}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <span className="font-mono tabular-nums text-base sm:text-lg font-semibold text-[#1F2421] leading-none">
              M{tableNumber}
            </span>
            <span className="mt-1 text-[10px] font-medium text-[#5C635E] group-hover:text-[#0F6B4E] transition-colors leading-none">
              10 sillas
            </span>
          </div>
        )}
      </button>
    </div>
  );
}
