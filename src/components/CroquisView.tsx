import {
  MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Crosshair,
  Hand,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import croquisHdImg from '../assets/images/croquis_salon_hd_1795641348750.jpg';
import {
  AssignmentsMap,
  SEATS_PER_TABLE,
  TAG_LABELS,
  TableAssignment,
  TableSelection,
  buildTableId,
  formatRemainingSeats,
  getRemainingSeats,
} from '../types/seating';
import { ToldoStats } from '../hooks/useSeatingStore';

interface CroquisViewProps {
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
  onSelectTable: (selection: TableSelection) => void;
  initialFocusToldoId?: number | null;
  onClearInitialFocus?: () => void;
}

type CroquisFilter =
  | 'todas'
  | 'ocupadas'
  | 'libres'
  | 'sobrantes'
  | 'vip'
  | 'limpio';

type ShapeFilter = 'todas' | 'round' | 'rect';
type TableShape = 'round' | 'rect';

interface ToldoBand {
  toldoId: number;
  toldoName: string;
  topPct: number;
  heightPct: number;
}

interface TableLayoutSlot {
  tableNumber: number;
  shape: TableShape;
  xPct: number;
  yOffsetRatio: number;
}

const MIN_ZOOM = 100;
const MAX_ZOOM = 250;
const ZOOM_STEP = 30;

/**
 * Exact vertical canopy bands measured from the remastered 1200x896 HD croquis.
 * Toldo 4 (51.8% – 63.3%) is the Dance Floor / Stage band.
 */
const TOLDO_BANDS: ToldoBand[] = [
  { toldoId: 8, toldoName: 'TOLDO 8', topPct: 4.1, heightPct: 11.9 },
  { toldoId: 3, toldoName: 'TOLDO 3', topPct: 16.0, heightPct: 11.9 },
  { toldoId: 2, toldoName: 'TOLDO 2', topPct: 27.9, heightPct: 11.9 },
  { toldoId: 1, toldoName: 'TOLDO 1', topPct: 39.8, heightPct: 11.8 },
  { toldoId: 5, toldoName: 'TOLDO 5', topPct: 63.4, heightPct: 11.5 },
  { toldoId: 6, toldoName: 'TOLDO 6', topPct: 74.9, heightPct: 11.3 },
  { toldoId: 7, toldoName: 'TOLDO 7', topPct: 86.2, heightPct: 11.4 },
];

/**
 * Exact 15-table architectural placement per Toldo matching the alternating
 * round & rectangular banquet tables drawn inside the HD croquis:
 * - Top row (M1..M7): Round, Rect, Round, Rect, Round, Rect, Round
 * - Bottom row (M8..M14): Rect, Round, Rect, Round, Rect, Round, Rect
 * - Right wing (M15): Round table in the clean right aisle between plants
 */
const TABLE_SLOTS: TableLayoutSlot[] = [
  // Top row (7 alternating tables)
  { tableNumber: 1, shape: 'round', xPct: 23.7, yOffsetRatio: 0.29 },
  { tableNumber: 2, shape: 'rect', xPct: 33.4, yOffsetRatio: 0.29 },
  { tableNumber: 3, shape: 'round', xPct: 42.6, yOffsetRatio: 0.29 },
  { tableNumber: 4, shape: 'rect', xPct: 51.9, yOffsetRatio: 0.29 },
  { tableNumber: 5, shape: 'round', xPct: 60.9, yOffsetRatio: 0.29 },
  { tableNumber: 6, shape: 'rect', xPct: 70.1, yOffsetRatio: 0.29 },
  { tableNumber: 7, shape: 'round', xPct: 79.3, yOffsetRatio: 0.29 },
  // Bottom row (7 alternating tables)
  { tableNumber: 8, shape: 'rect', xPct: 26.3, yOffsetRatio: 0.75 },
  { tableNumber: 9, shape: 'round', xPct: 34.8, yOffsetRatio: 0.75 },
  { tableNumber: 10, shape: 'rect', xPct: 43.3, yOffsetRatio: 0.75 },
  { tableNumber: 11, shape: 'round', xPct: 52.0, yOffsetRatio: 0.75 },
  { tableNumber: 12, shape: 'rect', xPct: 60.5, yOffsetRatio: 0.75 },
  { tableNumber: 13, shape: 'round', xPct: 69.0, yOffsetRatio: 0.75 },
  { tableNumber: 14, shape: 'rect', xPct: 77.5, yOffsetRatio: 0.75 },
  // Table 15 (clean right-wing round table inside the hall wall)
  { tableNumber: 15, shape: 'round', xPct: 83.9, yOffsetRatio: 0.52 },
];

const ROUND_CHAIRS = Array.from({ length: SEATS_PER_TABLE }, (_, idx) => {
  const angleDeg = idx * 36 - 90;
  const rad = (angleDeg * Math.PI) / 180;
  return {
    chairNum: idx + 1,
    cx: Number((40 + 31 * Math.cos(rad)).toFixed(1)),
    cy: Number((40 + 31 * Math.sin(rad)).toFixed(1)),
    rot: angleDeg + 90,
  };
});

// 10 chairs around a rectangular banquet table: 4 top, 4 bottom, 1 left head, 1 right head
const RECT_CHAIRS: { chairNum: number; x: number; y: number; w: number; h: number }[] = [
  { chairNum: 1, x: 20, y: 2, w: 12, h: 7 },
  { chairNum: 2, x: 38, y: 2, w: 12, h: 7 },
  { chairNum: 3, x: 56, y: 2, w: 12, h: 7 },
  { chairNum: 4, x: 74, y: 2, w: 12, h: 7 },
  { chairNum: 5, x: 96, y: 21, w: 7, h: 12 },
  { chairNum: 6, x: 74, y: 45, w: 12, h: 7 },
  { chairNum: 7, x: 56, y: 45, w: 12, h: 7 },
  { chairNum: 8, x: 38, y: 45, w: 12, h: 7 },
  { chairNum: 9, x: 20, y: 45, w: 12, h: 7 },
  { chairNum: 10, x: 3, y: 21, w: 7, h: 12 },
];

function getShortLabel(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name.slice(0, 11);
  if (parts[0].toLowerCase() === 'familia' && parts[1]) {
    return parts[1].slice(0, 11);
  }
  return parts[0].slice(0, 11);
}

function RoundCroquisTable({
  tableNumber,
  entry,
  zoom,
}: {
  tableNumber: number;
  entry?: TableAssignment;
  zoom: number;
}) {
  const isOccupied = Boolean(entry);
  const occupiedCount = entry?.guestsCount ?? 0;
  const isVipOrHonor = entry?.tag === 'vip' || entry?.tag === 'honor';

  return (
    <svg
      viewBox="0 0 80 80"
      className="w-full h-full overflow-visible drop-shadow-[0_2px_5px_rgba(0,0,0,0.45)]"
      aria-hidden="true"
    >
      {/* 10 miniature chairs */}
      {ROUND_CHAIRS.map((chair) => {
        const filled = isOccupied && chair.chairNum <= occupiedCount;
        return (
          <rect
            key={chair.chairNum}
            x={chair.cx - 4.2}
            y={chair.cy - 2.6}
            width="8.4"
            height="5.2"
            rx="2"
            transform={`rotate(${chair.rot} ${chair.cx} ${chair.cy})`}
            fill={
              filled
                ? isVipOrHonor
                  ? '#F1D68A'
                  : '#0F6B4E'
                : isOccupied
                  ? '#FBF9F5'
                  : 'rgba(251,249,245,0.82)'
            }
            stroke={
              filled
                ? isVipOrHonor
                  ? '#8E6D24'
                  : '#0A4633'
                : '#B59449'
            }
            strokeWidth="1.2"
          />
        );
      })}

      {/* Round tabletop */}
      <circle
        cx="40"
        cy="40"
        r="24"
        fill={isOccupied ? '#0F6B4E' : 'rgba(251,249,245,0.82)'}
        stroke={
          isOccupied ? (isVipOrHonor ? '#F1D68A' : '#D4B45E') : '#B59449'
        }
        strokeWidth={isOccupied ? 3 : 2}
      />
      {isOccupied && isVipOrHonor && (
        <circle
          cx="40"
          cy="40"
          r="20.5"
          fill="none"
          stroke="#F1D68A"
          strokeWidth="0.9"
          strokeDasharray="3 2"
        />
      )}

      <text
        x="40"
        y={isOccupied ? '37' : '44'}
        textAnchor="middle"
        fill={isOccupied ? '#FFFFFF' : '#1F2421'}
        fontSize={isOccupied ? '13.5' : '15'}
        fontWeight="700"
        fontFamily="IBM Plex Mono, monospace"
      >
        M{tableNumber}
      </text>
      {isOccupied && entry && (
        <text
          x="40"
          y="50.5"
          textAnchor="middle"
          fill="#F3DF9E"
          fontSize={zoom >= 150 ? '8.5' : '10.5'}
          fontWeight="600"
          fontFamily="IBM Plex Mono, monospace"
        >
          {zoom >= 150 ? getShortLabel(entry.guestName) : `${entry.guestsCount}/10`}
        </text>
      )}
    </svg>
  );
}

function RectCroquisTable({
  tableNumber,
  entry,
  zoom,
}: {
  tableNumber: number;
  entry?: TableAssignment;
  zoom: number;
}) {
  const isOccupied = Boolean(entry);
  const occupiedCount = entry?.guestsCount ?? 0;
  const isVipOrHonor = entry?.tag === 'vip' || entry?.tag === 'honor';

  return (
    <svg
      viewBox="0 0 106 54"
      className="w-full h-full overflow-visible drop-shadow-[0_2px_5px_rgba(0,0,0,0.45)]"
      aria-hidden="true"
    >
      {/* 10 miniature banquet chairs (4 top, 4 bottom, 1 left, 1 right) */}
      {RECT_CHAIRS.map((chair) => {
        const filled = isOccupied && chair.chairNum <= occupiedCount;
        return (
          <rect
            key={chair.chairNum}
            x={chair.x}
            y={chair.y}
            width={chair.w}
            height={chair.h}
            rx="2"
            fill={
              filled
                ? isVipOrHonor
                  ? '#F1D68A'
                  : '#0F6B4E'
                : isOccupied
                  ? '#FBF9F5'
                  : 'rgba(251,249,245,0.82)'
            }
            stroke={
              filled
                ? isVipOrHonor
                  ? '#8E6D24'
                  : '#0A4633'
                : '#B59449'
            }
            strokeWidth="1.2"
          />
        );
      })}

      {/* Rectangular banquet tabletop */}
      <rect
        x="12"
        y="11"
        width="82"
        height="32"
        rx="6"
        fill={isOccupied ? '#0F6B4E' : 'rgba(251,249,245,0.82)'}
        stroke={
          isOccupied ? (isVipOrHonor ? '#F1D68A' : '#D4B45E') : '#B59449'
        }
        strokeWidth={isOccupied ? 2.8 : 2}
      />
      {isOccupied && isVipOrHonor && (
        <rect
          x="15"
          y="14"
          width="76"
          height="26"
          rx="4"
          fill="none"
          stroke="#F1D68A"
          strokeWidth="0.9"
          strokeDasharray="3 2"
        />
      )}

      <text
        x="53"
        y={isOccupied ? '25.5' : '31.5'}
        textAnchor="middle"
        fill={isOccupied ? '#FFFFFF' : '#1F2421'}
        fontSize={isOccupied ? '12.5' : '14'}
        fontWeight="700"
        fontFamily="IBM Plex Mono, monospace"
      >
        M{tableNumber}
        {isOccupied && entry && zoom < 145 ? ` · ${entry.guestsCount}/10` : ''}
      </text>
      {isOccupied && entry && zoom >= 145 && (
        <text
          x="53"
          y="37.5"
          textAnchor="middle"
          fill="#F3DF9E"
          fontSize="9.5"
          fontWeight="600"
          fontFamily="Plus Jakarta Sans, sans-serif"
        >
          {getShortLabel(entry.guestName)} ({entry.guestsCount}/10)
        </text>
      )}
    </svg>
  );
}

export function CroquisView({
  assignments,
  toldoStats,
  totals,
  onSelectTable,
  initialFocusToldoId,
  onClearInitialFocus,
}: CroquisViewProps) {
  const [filter, setFilter] = useState<CroquisFilter>('todas');
  const [shapeFilter, setShapeFilter] = useState<ShapeFilter>('todas');
  const [zoom, setZoom] = useState<number>(100);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [focusedToldoId, setFocusedToldoId] = useState<number | null>(null);
  const [imgError, setImgError] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const inlineScrollRef = useRef<HTMLDivElement>(null);
  const fullscreenScrollRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  useEffect(() => {
    if (!expanded) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpanded(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [expanded]);

  const statsByToldo = useMemo(() => {
    const map = new Map<number, ToldoStats>();
    for (const s of toldoStats) map.set(s.toldoId, s);
    return map;
  }, [toldoStats]);

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const markers = useMemo(() => {
    const list: {
      tableId: string;
      toldoId: number;
      toldoName: string;
      tableNumber: number;
      shape: TableShape;
      xPct: number;
      yPct: number;
      isOccupied: boolean;
      matchesFilter: boolean;
      matchesQuery: boolean;
    }[] = [];

    for (const band of TOLDO_BANDS) {
      for (const slot of TABLE_SLOTS) {
        const tableId = buildTableId(band.toldoId, slot.tableNumber);
        const entry = assignments[tableId];
        const isOccupied = Boolean(entry);
        const hasSpare =
          isOccupied && getRemainingSeats(entry!.guestsCount) > 0;
        const isVip =
          isOccupied && (entry?.tag === 'vip' || entry?.tag === 'honor');

        let matchesFilter = true;
        if (filter === 'ocupadas') matchesFilter = isOccupied;
        else if (filter === 'libres') matchesFilter = !isOccupied;
        else if (filter === 'sobrantes') matchesFilter = hasSpare;
        else if (filter === 'vip') matchesFilter = isVip;

        if (shapeFilter !== 'todas' && slot.shape !== shapeFilter) {
          matchesFilter = false;
        }

        let matchesQuery = true;
        if (trimmedQuery) {
          const hay = [
            band.toldoName,
            `m${slot.tableNumber}`,
            `mesa ${slot.tableNumber}`,
            slot.shape === 'round' ? 'redonda' : 'rectangular',
            entry ? entry.guestName : 'libre',
            entry ? TAG_LABELS[entry.tag] : '',
            entry ? entry.notes : '',
          ]
            .join(' ')
            .toLowerCase();
          matchesQuery = hay.includes(trimmedQuery);
        }

        list.push({
          tableId,
          toldoId: band.toldoId,
          toldoName: band.toldoName,
          tableNumber: slot.tableNumber,
          shape: slot.shape,
          xPct: slot.xPct,
          yPct: band.topPct + band.heightPct * slot.yOffsetRatio,
          isOccupied,
          matchesFilter,
          matchesQuery,
        });
      }
    }

    return list;
  }, [assignments, filter, shapeFilter, trimmedQuery]);

  const matchingSearchMarkers = useMemo(
    () => markers.filter((m) => trimmedQuery && m.matchesQuery && m.matchesFilter),
    [markers, trimmedQuery]
  );

  const hoveredMarker = useMemo(
    () => markers.find((m) => m.tableId === hoveredTableId) ?? null,
    [hoveredTableId, markers]
  );
  const hoveredAssignment = hoveredMarker
    ? assignments[hoveredMarker.tableId]
    : undefined;

  const getActiveContainer = () =>
    expanded ? fullscreenScrollRef.current : inlineScrollRef.current;

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  const resetView = () => {
    setZoom(100);
    setFocusedToldoId(null);
    const el = getActiveContainer();
    if (el) {
      el.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    }
  };

  const focusPoint = (xPct: number, yPct: number, targetZoom = 170) => {
    setZoom(targetZoom);
    window.setTimeout(() => {
      const el = getActiveContainer();
      if (!el) return;
      const targetLeft = Math.max(
        0,
        (el.scrollWidth * xPct) / 100 - el.clientWidth / 2
      );
      const targetTop = Math.max(
        0,
        (el.scrollHeight * yPct) / 100 - el.clientHeight / 2
      );
      el.scrollTo({ left: targetLeft, top: targetTop, behavior: 'smooth' });
    }, 60);
  };

  const handleFocusToldo = (toldoId: number) => {
    setFocusedToldoId(toldoId);
    if (toldoId === 4) {
      focusPoint(52, 57.5, 165);
      return;
    }
    const band = TOLDO_BANDS.find((b) => b.toldoId === toldoId);
    if (!band) return;
    focusPoint(52, band.topPct + band.heightPct * 0.5, 165);
  };

  useEffect(() => {
    if (initialFocusToldoId == null) return;
    handleFocusToldo(initialFocusToldoId);
    onClearInitialFocus?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFocusToldoId]);

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    dragStateRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
  };

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state.active) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) > 6) {
      state.moved = true;
      setIsDragging(true);
    }
    if (state.moved) {
      e.currentTarget.scrollLeft = state.scrollLeft - dx;
      e.currentTarget.scrollTop = state.scrollTop - dy;
    }
  };

  const endDrag = () => {
    dragStateRef.current.active = false;
    if (isDragging) {
      window.setTimeout(() => setIsDragging(false), 40);
    }
  };

  const renderCroquisCanvas = (isFullscreen: boolean) => (
    <div
      ref={isFullscreen ? fullscreenScrollRef : inlineScrollRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      className={`overflow-auto rounded-xl border border-[#D4B45E]/65 bg-[#1B1712] shadow-[0_20px_50px_-16px_rgba(0,0,0,0.85)] ${
        zoom > 100 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
      } ${isFullscreen ? 'flex-1' : 'max-h-[82vh]'}`}
    >
      <div
        className="mx-auto transition-[width] duration-200 ease-out p-2 sm:p-4"
        style={{
          width: `${zoom}%`,
          minWidth: isFullscreen ? '860px' : '760px',
        }}
      >
        <div className="relative w-full aspect-[1200/896] rounded-lg overflow-hidden bg-[#EFE7DB] shadow-inner select-none">
          {!imgError ? (
            <img
              src={croquisHdImg}
              alt="Croquis arquitectónico HD de los 8 toldos y distribución de mesas redondas y rectangulares (16,00 m × 64,00 m)"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-fill block"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#F3EFE6] text-sm text-[#5C635E]">
              No se pudo cargar la imagen del croquis.
            </div>
          )}

          {/* Clickable left Toldo badges to zoom directly into any canopy */}
          {filter !== 'limpio' &&
            TOLDO_BANDS.map((band) => {
              const stat = statsByToldo.get(band.toldoId);
              const isFocused = focusedToldoId === band.toldoId;
              return (
                <button
                  key={`badge-${band.toldoId}`}
                  type="button"
                  onClick={() => {
                    if (dragStateRef.current.moved) return;
                    handleFocusToldo(band.toldoId);
                  }}
                  title={`Enfocar ${band.toldoName} (${stat?.occupiedTables ?? 0}/15 mesas ocupadas)`}
                  style={{
                    top: `${band.topPct + band.heightPct * 0.5}%`,
                    left: '7.8%',
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-[11.2%] h-[9.2%] rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6B4E] ${
                    isFocused
                      ? 'ring-2 ring-[#0F6B4E] bg-[#0F6B4E]/12'
                      : 'hover:ring-2 hover:ring-[#D4B45E]/80 hover:bg-[#D4B45E]/10'
                  }`}
                >
                  {stat && stat.occupiedTables > 0 && (
                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-[#0F6B4E] text-[#FBF9F5] border border-[#F1D68A]/90 rounded px-1.5 py-0.5 font-mono tabular-nums text-[9px] font-semibold shadow-md whitespace-nowrap">
                      {stat.occupiedTables}/15 ocup.
                    </span>
                  )}
                </button>
              );
            })}

          {/* Interactive Round & Rectangular Table Shapes synced live with Firestore */}
          {filter !== 'limpio' &&
            markers.map((marker) => {
              const entry = assignments[marker.tableId];
              const isDimmedByFilter = !marker.matchesFilter;
              const isDimmedBySearch =
                Boolean(trimmedQuery) && !marker.matchesQuery;
              const isDimmed = isDimmedByFilter || isDimmedBySearch;
              const isSpotlight =
                Boolean(trimmedQuery) &&
                marker.matchesQuery &&
                marker.matchesFilter;
              const isHovered = hoveredTableId === marker.tableId;

              if (filter === 'ocupadas' && !marker.isOccupied) return null;
              if (filter === 'libres' && marker.isOccupied) return null;
              if (filter === 'sobrantes' && isDimmedByFilter) return null;
              if (filter === 'vip' && isDimmedByFilter) return null;

              const sizeClass =
                marker.shape === 'round'
                  ? marker.tableNumber === 15
                    ? 'w-[4.15%] aspect-square'
                    : 'w-[5.1%] aspect-square'
                  : 'w-[7.25%] aspect-[106/54]';

              return (
                <button
                  key={marker.tableId}
                  type="button"
                  onClick={() => {
                    if (dragStateRef.current.moved) return;
                    onSelectTable({
                      tableId: marker.tableId,
                      toldoId: marker.toldoId,
                      toldoName: marker.toldoName,
                      tableNumber: marker.tableNumber,
                    });
                  }}
                  onMouseEnter={() => setHoveredTableId(marker.tableId)}
                  onMouseLeave={() =>
                    setHoveredTableId((curr) =>
                      curr === marker.tableId ? null : curr
                    )
                  }
                  onFocus={() => setHoveredTableId(marker.tableId)}
                  onBlur={() =>
                    setHoveredTableId((curr) =>
                      curr === marker.tableId ? null : curr
                    )
                  }
                  aria-label={
                    entry
                      ? `${marker.toldoName}, Mesa ${marker.tableNumber} (${
                          marker.shape === 'round' ? 'Redonda' : 'Rectangular'
                        }), reservada para ${entry.guestName}, ${
                          entry.guestsCount
                        } de 10 sillas ocupadas`
                      : `${marker.toldoName}, Mesa ${marker.tableNumber} (${
                          marker.shape === 'round' ? 'Redonda' : 'Rectangular'
                        }), disponible`
                  }
                  style={{
                    left: `${marker.xPct}%`,
                    top: `${marker.yPct}%`,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6B4E] ${sizeClass} ${
                    marker.shape === 'round' ? 'rounded-full' : 'rounded-md'
                  } ${
                    isDimmed
                      ? 'opacity-18 scale-92'
                      : isHovered
                        ? 'scale-118 z-30'
                        : marker.isOccupied
                          ? 'z-10 hover:scale-115'
                          : 'z-10 hover:scale-112'
                  } ${
                    isSpotlight
                      ? 'ring-2 ring-[#F1D68A] ring-offset-2 ring-offset-[#0A0B0A] z-30 scale-115'
                      : ''
                  }`}
                >
                  {marker.shape === 'round' ? (
                    <RoundCroquisTable
                      tableNumber={marker.tableNumber}
                      entry={entry}
                      zoom={zoom}
                    />
                  ) : (
                    <RectCroquisTable
                      tableNumber={marker.tableNumber}
                      entry={entry}
                      zoom={zoom}
                    />
                  )}
                </button>
              );
            })}

          {/* Dynamic Floating Tooltip anchored near hovered table */}
          {filter !== 'limpio' && hoveredMarker && (
            <div
              style={{
                left: `${Math.min(82, Math.max(22, hoveredMarker.xPct))}%`,
                top:
                  hoveredMarker.yPct < 20
                    ? `${hoveredMarker.yPct + 7.5}%`
                    : `${hoveredMarker.yPct - 7.5}%`,
              }}
              className={`pointer-events-none absolute -translate-x-1/2 z-40 w-56 sm:w-64 bg-[#0A0B0A]/95 text-[#FBF9F5] border border-[#D4B45E]/85 rounded-xl px-3.5 py-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.75)] ${
                hoveredMarker.yPct < 20 ? 'translate-y-0' : '-translate-y-full'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-[#F1D68A]">
                <span>
                  {hoveredMarker.toldoName} · Mesa {hoveredMarker.tableNumber}
                </span>
                <span className="text-[#F3EFE6]/75">
                  {hoveredMarker.shape === 'round' ? 'Redonda' : 'Rectangular'}
                </span>
              </div>
              {hoveredAssignment ? (
                <>
                  <p className="mt-1 text-xs font-semibold text-white truncate">
                    {hoveredAssignment.guestName}
                  </p>
                  <p className="mt-0.5 text-[11px] font-mono tabular-nums text-[#8EE0C2]">
                    {hoveredAssignment.guestsCount}/10 sillas ocup. ·{' '}
                    <span className="text-[#F1D68A]">
                      {formatRemainingSeats(
                        getRemainingSeats(hoveredAssignment.guestsCount)
                      )}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#F3EFE6]/75 truncate">
                    {TAG_LABELS[hoveredAssignment.tag]}
                    {hoveredAssignment.notes
                      ? ` · ${hoveredAssignment.notes}`
                      : ''}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-[#F3EFE6]/85">
                  Disponible (10 sillas libres) · Haz clic para reservar
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header & Interactive Controls */}
      <section className="bg-[#FBF9F5]/92 backdrop-blur-md border border-[#D4B45E]/65 rounded-xl px-5 py-5 sm:px-7 sm:py-6 shadow-[0_18px_42px_-14px_rgba(0,0,0,0.82)]">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1F2421] tracking-tight">
              Croquis General del Salón
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-[#5C635E]">
              <span className="font-mono tabular-nums font-semibold text-[#0F6B4E]">
                {totals.occupiedTables} / {totals.totalTables}
              </span>
              <span>mesas ocupadas</span>
              <span aria-hidden="true" className="text-[#C9A959]">
                ·
              </span>
              <span className="font-mono tabular-nums font-medium text-[#1F2421]">
                {totals.assignedGuests.toLocaleString('es-ES')} /{' '}
                {totals.totalCapacity.toLocaleString('es-ES')}
              </span>
              <span>sillas ocupadas</span>
              <span aria-hidden="true" className="text-[#C9A959]">
                ·
              </span>
              <span className="font-mono tabular-nums font-medium text-[#B59449]">
                {totals.spareSeatsInReserved.toLocaleString('es-ES')}
              </span>
              <span>sobrantes</span>
              <span aria-hidden="true" className="text-[#C9A959]">
                ·
              </span>
              <span>Mesas redondas y rectangulares (16 × 64 m)</span>
            </div>
          </div>

          {/* Search, Spotlight Center & Fullscreen CTA */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 no-print">
            <div className="relative flex-1 sm:w-64">
              <Search
                className="w-4 h-4 text-[#5C635E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ubicar invitado, mesa o forma..."
                aria-label="Ubicar invitado, mesa o forma en el croquis"
                className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-[#E4DCCE] rounded-lg text-[#1F2421] placeholder:text-[#5C635E]/70 focus:outline-none focus:ring-2 focus:ring-[#0F6B4E]/25 focus:border-[#0F6B4E]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#5C635E] hover:text-[#1F2421]"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {matchingSearchMarkers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const first = matchingSearchMarkers[0];
                  setFocusedToldoId(first.toldoId);
                  focusPoint(first.xPct, first.yPct, 185);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1F2421] bg-[#F3EFE6] hover:bg-[#E4DCCE] border border-[#C9A959]/70 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Crosshair className="w-3.5 h-3.5 text-[#0F6B4E]" aria-hidden="true" />
                <span>
                  Centrar ({matchingSearchMarkers.length})
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F6B4E] hover:bg-[#0B533C] border border-[#D4B45E]/80 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5 text-[#F1D68A]" aria-hidden="true" />
              <span>Pantalla completa</span>
            </button>
          </div>
        </div>

        {/* Status filter, Shape filter & Interactive Zoom slider */}
        <div className="mt-4 pt-4 border-t border-[#E4DCCE]/70 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              role="group"
              aria-label="Filtrar mesas en el croquis"
              className="inline-flex p-1 bg-[#F3EFE6] border border-[#E4DCCE] rounded-lg overflow-x-auto no-scrollbar max-w-full"
            >
              {(
                [
                  { id: 'todas', label: 'Todas' },
                  { id: 'ocupadas', label: `Ocupadas (${totals.occupiedTables})` },
                  { id: 'libres', label: 'Libres' },
                  { id: 'sobrantes', label: 'Con sobrantes' },
                  { id: 'vip', label: 'VIP' },
                  { id: 'limpio', label: 'Solo croquis' },
                ] as { id: CroquisFilter; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFilter(opt.id)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    filter === opt.id
                      ? 'bg-white text-[#1F2421] shadow-xs'
                      : 'text-[#5C635E] hover:text-[#1F2421]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {filter !== 'limpio' && (
              <div
                role="group"
                aria-label="Filtrar por forma de mesa"
                className="inline-flex p-1 bg-[#F3EFE6] border border-[#E4DCCE] rounded-lg"
              >
                {(
                  [
                    { id: 'todas', label: 'Ambas formas' },
                    { id: 'round', label: 'Redondas' },
                    { id: 'rect', label: 'Rectangulares' },
                  ] as { id: ShapeFilter; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setShapeFilter(opt.id)}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      shapeFilter === opt.id
                        ? 'bg-white text-[#1F2421] shadow-xs'
                        : 'text-[#5C635E] hover:text-[#1F2421]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Smooth Zoom controls + range slider */}
          <div className="inline-flex items-center gap-1.5 p-1 bg-[#F3EFE6] border border-[#E4DCCE] rounded-lg">
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Alejar croquis"
              className="p-1.5 text-[#1F2421] hover:bg-white disabled:opacity-35 rounded-md transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={10}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Nivel de zoom del croquis"
              className="w-20 sm:w-24 accent-[#0F6B4E] cursor-pointer"
            />
            <span className="font-mono tabular-nums text-xs font-semibold text-[#1F2421] min-w-[40px] text-center">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Acercar croquis"
              className="p-1.5 text-[#1F2421] hover:bg-white disabled:opacity-35 rounded-md transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            {(zoom !== 100 || focusedToldoId !== null) && (
              <button
                type="button"
                onClick={resetView}
                aria-label="Restablecer vista al 100%"
                className="p-1.5 text-[#5C635E] hover:text-[#1F2421] hover:bg-white rounded-md transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Interactive Toldo Quick-Zoom Row & Legend */}
        <div className="mt-3 pt-3 border-t border-[#E4DCCE]/60 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[#5C635E] mr-1 shrink-0">Enfocar toldo:</span>
            {[8, 3, 2, 1, 4, 5, 6, 7].map((id) => {
              const stat = statsByToldo.get(id);
              const isFocused = focusedToldoId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleFocusToldo(id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 border ${
                    isFocused
                      ? 'bg-[#0F6B4E] text-white border-[#0B533C]'
                      : 'bg-white text-[#1F2421] border-[#E4DCCE] hover:border-[#B59449]'
                  }`}
                >
                  {id === 4 ? (
                    'Pista (T4)'
                  ) : (
                    <>
                      T{id}{' '}
                      <span
                        className={`font-mono tabular-nums ${
                          isFocused ? 'text-[#F3DF9E]' : 'text-[#5C635E]'
                        }`}
                      >
                        {stat?.occupiedTables ?? 0}/15
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3.5 text-[#5C635E]">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                aria-hidden="true"
                className="w-3 h-3 rounded-full bg-[#0F6B4E] border border-[#D4B45E]"
              />
              Redonda ocup.
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                aria-hidden="true"
                className="w-4 h-2.5 rounded-[3px] bg-[#0F6B4E] border border-[#D4B45E]"
              />
              Rectangular ocup.
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                aria-hidden="true"
                className="w-3 h-3 rounded-full bg-white border border-[#B59449]"
              />
              Libre
            </span>
          </div>
        </div>
      </section>

      {/* Live Inspector & Pan Hint Bar */}
      <div className="mt-4 bg-[#0A0B0A]/85 backdrop-blur-sm border border-[#D4B45E]/55 rounded-xl px-4 py-2.5 text-xs text-[#F3EFE6] flex flex-wrap items-center justify-between gap-2 min-h-[42px] no-print">
        {hoveredMarker ? (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-mono tabular-nums font-semibold text-[#F1D68A]">
              {hoveredMarker.toldoName} · Mesa {hoveredMarker.tableNumber}
            </span>
            <span aria-hidden="true" className="text-[#C9A959]">
              ·
            </span>
            <span className="text-[#F3EFE6]/80">
              {hoveredMarker.shape === 'round'
                ? 'Mesa redonda'
                : 'Mesa rectangular'}
            </span>
            <span aria-hidden="true" className="text-[#C9A959]">
              ·
            </span>
            {hoveredAssignment ? (
              <>
                <span className="font-semibold text-white">
                  {hoveredAssignment.guestName}
                </span>
                <span aria-hidden="true" className="text-[#C9A959]">
                  ·
                </span>
                <span className="font-mono tabular-nums text-[#8EE0C2]">
                  {hoveredAssignment.guestsCount}/10 sillas
                </span>
                <span aria-hidden="true" className="text-[#C9A959]">
                  ·
                </span>
                <span className="font-mono tabular-nums text-[#F1D68A]">
                  {formatRemainingSeats(
                    getRemainingSeats(hoveredAssignment.guestsCount)
                  )}
                </span>
              </>
            ) : (
              <span className="text-[#F3EFE6]/85">
                Disponible (10 sillas) · Haz clic para reservar
              </span>
            )}
          </div>
        ) : (
          <span className="text-[#F3EFE6]/80">
            Haz clic en cualquier mesa redonda o rectangular para reservar o
            consultar; haz clic en un toldo para acercarlo.
          </span>
        )}

        {zoom > 100 && (
          <span className="inline-flex items-center gap-1.5 text-[#F1D68A] whitespace-nowrap shrink-0">
            <Hand className="w-3.5 h-3.5" aria-hidden="true" />
            Arrastra para desplazar
          </span>
        )}
      </div>

      {/* Main HD Interactive Croquis Viewer */}
      <div className="mt-4">{renderCroquisCanvas(false)}</div>

      {/* Fullscreen Enlarged Croquis Modal */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-[#0A0907]/95 backdrop-blur-md p-3 sm:p-5 flex flex-col gap-3 no-print"
          role="dialog"
          aria-modal="true"
          aria-label="Croquis HD del salón en pantalla completa"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#14110D] border border-[#D4B45E]/55 rounded-xl px-4 py-2.5 text-xs text-[#F3EFE6]">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="font-display text-lg font-bold text-[#FBF9F5]">
                Croquis HD del Salón
              </span>
              <span aria-hidden="true" className="text-[#C9A959]">
                ·
              </span>
              <span className="font-mono tabular-nums text-[#8EE0C2] font-semibold">
                {totals.occupiedTables}/{totals.totalTables} ocupadas
              </span>
              {hoveredMarker && (
                <>
                  <span aria-hidden="true" className="text-[#C9A959]">
                    ·
                  </span>
                  <span className="font-mono tabular-nums text-[#F1D68A]">
                    {hoveredMarker.toldoName} M{hoveredMarker.tableNumber} (
                    {hoveredMarker.shape === 'round' ? 'Redonda' : 'Rectangular'}
                    ):{' '}
                    {hoveredAssignment
                      ? `${hoveredAssignment.guestName} (${hoveredAssignment.guestsCount}/10)`
                      : 'Disponible'}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 p-1 bg-white/10 border border-[#C9A959]/40 rounded-lg">
                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={zoom <= MIN_ZOOM}
                  aria-label="Alejar"
                  className="p-1.5 text-white hover:bg-white/15 disabled:opacity-35 rounded"
                >
                  <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <span className="px-2 font-mono tabular-nums text-xs font-semibold text-[#F1D68A] min-w-[44px] text-center">
                  {zoom}%
                </span>
                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={zoom >= MAX_ZOOM}
                  aria-label="Acercar"
                  className="p-1.5 text-white hover:bg-white/15 disabled:opacity-35 rounded"
                >
                  <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#FBF9F5] bg-[#0F6B4E] hover:bg-[#0B533C] border border-[#D4B45E]/80 rounded-lg transition-colors whitespace-nowrap"
              >
                <Minimize2 className="w-3.5 h-3.5 text-[#F1D68A]" aria-hidden="true" />
                <span>Cerrar pantalla completa</span>
              </button>
            </div>
          </div>

          {renderCroquisCanvas(true)}
        </div>
      )}
    </div>
  );
}
