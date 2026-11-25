import {
  AssignmentsMap,
  SEATING_TOLDOS,
  SEATS_PER_TABLE,
  TAG_LABELS,
  TOLDOS_CONFIG,
  buildTableId,
  getRemainingSeats,
} from '../types/seating';

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportToCSV(assignments: AssignmentsMap): void {
  const headers = [
    'Toldo',
    'Mesa',
    'Estado',
    'Invitado o Familia',
    'Sillas ocupadas',
    'Sillas sobrantes',
    'Etiqueta',
    'Notas',
  ];

  const rows: string[] = [headers.map(escapeCsvCell).join(',')];

  for (const toldo of SEATING_TOLDOS) {
    const count = toldo.mesas ?? 15;
    for (let i = 1; i <= count; i++) {
      const id = buildTableId(toldo.id, i);
      const entry = assignments[id];
      if (entry) {
        const occupied = Math.min(SEATS_PER_TABLE, Math.max(1, entry.guestsCount));
        const remaining = getRemainingSeats(occupied);
        rows.push(
          [
            toldo.name,
            `Mesa ${i}`,
            'Reservada',
            entry.guestName,
            occupied,
            remaining,
            TAG_LABELS[entry.tag],
            entry.notes,
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      } else {
        rows.push(
          [toldo.name, `Mesa ${i}`, 'Libre', '', 0, SEATS_PER_TABLE, '', '']
            .map(escapeCsvCell)
            .join(',')
        );
      }
    }
  }

  // UTF-8 BOM so Microsoft Excel preserves Spanish accents cleanly
  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerFileDownload(blob, 'distribucion-mesas.csv');
}

export function exportToBackupJSON(assignments: AssignmentsMap): void {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    assignments,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  triggerFileDownload(blob, 'respaldo-plano-gala.json');
}

async function loadImageDataUri(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportToStandaloneHTML(
  assignments: AssignmentsMap
): Promise<void> {
  const safeInitialData = JSON.stringify(assignments).replace(/</g, '\\u003c');
  const safeToldos = JSON.stringify(TOLDOS_CONFIG).replace(/</g, '\\u003c');
  const [bannerDataUri, wallpaperDataUri, brandDataUri] = await Promise.all([
    loadImageDataUri('/assets/aistudio/image_2e94d0ae.png'),
    loadImageDataUri('/assets/aistudio/image_c6db970a.png'),
    loadImageDataUri('/assets/aistudio/image_b65aae5b.png'),
  ]);
  const headerBgMarkup = bannerDataUri
    ? `<img src="${bannerDataUri}" alt="" class="absolute inset-0 w-full h-full object-cover object-center opacity-30 blur-[2px] scale-105" />
      <div class="relative max-w-7xl mx-auto h-full">
        <img src="${bannerDataUri}" alt="Acto de Egreso" class="w-full h-full object-cover object-[center_46%] opacity-80" />
        <div class="absolute inset-0 bg-gradient-to-r from-[#0A0B0A] via-transparent to-[#0A0B0A]"></div>
      </div>`
    : `<div class="absolute inset-0 bg-gradient-to-r from-[#0A0B0A] via-[#1B170E] to-[#0A0B0A]"></div>`;

  const brandMarkup = brandDataUri
    ? `<span class="block h-14 w-[72px] sm:h-[76px] sm:w-[98px] overflow-hidden rounded-lg border border-[#D4B45E]/75 bg-[#0E0B07] shadow-[0_4px_16px_rgba(0,0,0,0.75)] shrink-0"><img src="${brandDataUri}" alt="Escuela de Comando y Estado Mayor del Ejército — Acto de Egreso" class="w-full h-full object-cover object-[50%_46%] scale-[1.18]" /></span>`
    : `<span class="font-display text-2xl sm:text-[30px] font-bold tracking-wide text-[#FBF9F5] drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] whitespace-nowrap">Plano de Gala</span>`;

  const wallpaperMarkup = wallpaperDataUri
    ? `<img src="${wallpaperDataUri}" alt="" class="w-full h-full object-cover object-[48%_46%] scale-[1.13] opacity-90 contrast-[1.12] saturate-[1.12]" />`
    : `<div class="w-full h-full bg-gradient-to-br from-[#16130E] via-[#0F0D0A] to-[#1A150D]"></div>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Plano de Gala — Distribución de Mesas (10 Sillas)</title>
  ${brandDataUri ? `<link rel="icon" type="image/png" href="${brandDataUri}" />` : ''}
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    body {
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      background-color: #12100C;
      color: #1F2421;
    }
    .font-display {
      font-family: 'Cormorant Garamond', Georgia, serif;
    }
    .font-mono-tab {
      font-family: 'IBM Plex Mono', monospace;
      font-variant-numeric: tabular-nums;
    }
    .gala-wood-floor {
      background-color: #6f4e32;
      background-image:
        repeating-linear-gradient(45deg, rgba(255,245,225,0.06) 0px, rgba(255,245,225,0.06) 12px, rgba(24,14,6,0.14) 12px, rgba(24,14,6,0.14) 24px),
        repeating-linear-gradient(-45deg, rgba(201,169,89,0.08) 0px, rgba(201,169,89,0.08) 1px, transparent 1px, transparent 24px);
    }
    @media print {
      @page { margin: 12mm; size: landscape; }
      body { background: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .print-avoid-break { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body class="relative min-h-screen antialiased bg-[#12100C]">
  <div aria-hidden="true" class="fixed inset-0 z-0 overflow-hidden pointer-events-none no-print bg-[#0A0907]">
    ${wallpaperMarkup}
    <div class="absolute inset-0 bg-gradient-to-b from-[#080705]/42 via-[#0A0806]/22 to-[#070604]/50"></div>
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(6,5,4,0.58)_100%)]"></div>
  </div>
  <header class="sticky top-0 z-30 bg-[#0A0B0A] border-b border-[#C9A959]/55 shadow-lg no-print">
    <div aria-hidden="true" class="absolute inset-0 overflow-hidden pointer-events-none">
      ${headerBgMarkup}
      <div class="absolute inset-0 bg-gradient-to-r from-[#0A0B0A]/90 via-[#0A0B0A]/58 to-[#0A0B0A]/90"></div>
      <div class="absolute inset-0 bg-gradient-to-b from-[#0A0B0A]/65 via-[#0A0B0A]/30 to-[#0A0B0A]/75"></div>
    </div>
    <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 h-20 sm:h-24 flex items-center justify-between gap-6">
      ${brandMarkup}
      <div class="flex items-center gap-3">
        <button id="btn-export-csv" type="button" class="px-3.5 py-2 text-xs font-semibold text-[#FBF9F5] bg-[#0A0B0A]/70 border border-[#D4B45E]/60 rounded-lg hover:bg-[#1F2421] transition-colors whitespace-nowrap">
          Exportar CSV
        </button>
        <button id="btn-print" type="button" class="px-4 py-2 text-xs font-semibold text-[#FBF9F5] bg-[#0F6B4E] border border-[#D4B45E]/80 rounded-lg hover:bg-[#13825F] transition-colors whitespace-nowrap">
          Imprimir plano
        </button>
      </div>
    </div>
  </header>

  <main class="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
    <div class="mb-6 bg-[#FBF9F5]/95 backdrop-blur-md border border-[#C9A959]/45 rounded-xl px-5 py-5 sm:px-7 sm:py-6 shadow-xl flex flex-col lg:flex-row lg:items-end justify-between gap-4">
      <div>
        <h1 class="font-display text-3xl sm:text-4xl font-bold text-[#1F2421] tracking-tight">Distribución de Mesas</h1>
        <p id="summary-line" class="mt-1.5 text-sm text-[#5C635E] font-mono-tab"></p>
      </div>
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 no-print">
        <input id="search-input" type="search" placeholder="Buscar invitado, mesa o nota..." class="px-3.5 py-2 text-sm bg-white border border-[#E4DCCE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6B4E]/30 focus:border-[#0F6B4E] w-full sm:w-64" />
        <div id="filter-group" class="inline-flex p-1 bg-[#F3EFE6] rounded-lg border border-[#E4DCCE] overflow-x-auto">
          <button data-filter="todas" type="button" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap">Todas</button>
          <button data-filter="libres" type="button" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap">Disponibles</button>
          <button data-filter="ocupadas" type="button" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap">Ocupadas</button>
          <button data-filter="sobrantes" type="button" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap">Con sobrantes</button>
          <button data-filter="vip" type="button" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap">VIP</button>
        </div>
      </div>
    </div>

    <div id="floor-plan" class="flex flex-col gap-5"></div>
  </main>

  <!-- Modal de Reserva (10 sillas) -->
  <div id="table-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 no-print overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div id="modal-backdrop" class="fixed inset-0 bg-[#1F2421]/50 backdrop-blur-[2px]"></div>
    <div class="relative bg-white rounded-2xl border border-[#E4DCCE] shadow-2xl w-full max-w-md p-6 my-auto">
      <div class="flex items-start justify-between gap-4 mb-5 pb-4 border-b border-[#E4DCCE]">
        <div>
          <p id="modal-subtitle" class="text-xs font-mono-tab text-[#B59449]"></p>
          <h3 id="modal-title" class="font-display text-2xl font-bold text-[#1F2421]">Reservar mesa</h3>
        </div>
        <button id="modal-close" type="button" aria-label="Cerrar" class="p-1.5 text-[#5C635E] hover:text-[#1F2421] rounded-lg hover:bg-[#F3EFE6] transition-colors">✕</button>
      </div>

      <form id="assignment-form" class="space-y-4">
        <div>
          <label for="guest-name" class="block text-xs font-semibold text-[#1F2421] mb-1.5">Nombre del invitado o familia</label>
          <input id="guest-name" type="text" autocomplete="off" placeholder="Ej. Familia Mendoza" class="w-full px-3.5 py-2.5 text-sm border border-[#E4DCCE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6B4E]/30 focus:border-[#0F6B4E]" />
          <p id="form-error" class="hidden mt-1 text-xs text-red-700"></p>
        </div>

        <div class="bg-[#FBF9F5] border border-[#E4DCCE] rounded-xl p-4">
          <div class="flex items-center justify-between gap-2 mb-2.5">
            <span class="text-xs font-semibold text-[#1F2421]">¿Cuántas sillas ocupará? (1 a 10)</span>
            <span id="modal-chairs-readout" class="text-xs font-mono-tab text-[#5C635E]">Sin seleccionar</span>
          </div>
          <div id="chair-picker-grid" class="grid grid-cols-5 gap-2"></div>
          <p id="chairs-error" class="hidden mt-2 text-xs text-red-700"></p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="guest-tag" class="block text-xs font-semibold text-[#1F2421] mb-1.5">Etiqueta</label>
            <select id="guest-tag" class="w-full px-3 py-2 text-sm border border-[#E4DCCE] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6B4E]/30 focus:border-[#0F6B4E]">
              <option value="estandar">Estándar</option>
              <option value="vip">VIP</option>
              <option value="familia">Familia</option>
              <option value="honor">Mesa de Honor</option>
            </select>
          </div>
          <div>
            <label for="guest-notes" class="block text-xs font-semibold text-[#1F2421] mb-1.5">Notas opcionales</label>
            <input id="guest-notes" type="text" autocomplete="off" placeholder="Ej. Menú infantil" class="w-full px-3 py-2 text-sm border border-[#E4DCCE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6B4E]/30 focus:border-[#0F6B4E]" />
          </div>
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-[#E4DCCE]">
          <button id="btn-free" type="button" class="hidden px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
            Liberar mesa
          </button>
          <div class="flex items-center gap-2 ml-auto">
            <button id="btn-cancel" type="button" class="px-4 py-2 text-xs font-semibold text-[#5C635E] hover:text-[#1F2421] bg-[#F3EFE6] hover:bg-[#E4DCCE]/60 rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" class="px-4 py-2 text-xs font-semibold text-white bg-[#0F6B4E] hover:bg-[#0B533C] rounded-lg transition-colors">
              Guardar reserva
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>

  <script>
    (function () {
      const STORAGE_KEY = 'plano_gala_standalone_v2';
      const SEATS_PER_TABLE = 10;
      const TOLDOS = ${safeToldos};
      const INITIAL_EMBEDDED = ${safeInitialData};
      const TAG_LABELS = { estandar: 'Estándar', vip: 'VIP', familia: 'Familia', honor: 'Mesa de Honor' };

      function loadState() {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) return JSON.parse(saved);
        } catch (e) {}
        return Object.assign({}, INITIAL_EMBEDDED);
      }

      let state = loadState();
      let searchQuery = '';
      let activeFilter = 'todas';
      let currentTableId = null;
      let selectedChairs = null;

      function persist() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
      }

      function getRemaining(count) {
        return Math.max(0, SEATS_PER_TABLE - Math.min(SEATS_PER_TABLE, Math.max(0, Number(count) || 0)));
      }

      function matches(tableId, tableNum, toldoName) {
        const entry = state[tableId];
        const isOccupied = Boolean(entry);
        const hasSpare = isOccupied && getRemaining(entry.guestsCount) > 0;
        const isVip = isOccupied && (entry.tag === 'vip' || entry.tag === 'honor');

        if (activeFilter === 'libres' && isOccupied) return false;
        if (activeFilter === 'ocupadas' && !isOccupied) return false;
        if (activeFilter === 'sobrantes' && !hasSpare) return false;
        if (activeFilter === 'vip' && !isVip) return false;

        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const hay = [
          toldoName,
          'm' + tableNum,
          'mesa ' + tableNum,
          entry ? entry.guestName : 'libre',
          entry ? (TAG_LABELS[entry.tag] || '') : '',
          entry ? (entry.notes || '') : ''
        ].join(' ').toLowerCase();
        return hay.includes(q);
      }

      function createTenChairsSvg(occupiedCount, isOccupied, isVip) {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 128 128');
        svg.setAttribute('class', 'absolute inset-0 w-full h-full pointer-events-none');
        svg.setAttribute('aria-hidden', 'true');
        for (let idx = 0; idx < SEATS_PER_TABLE; idx++) {
          const angleDeg = idx * 36 - 90;
          const angleRad = angleDeg * (Math.PI / 180);
          const cx = (64 + 54.5 * Math.cos(angleRad)).toFixed(2);
          const cy = (64 + 54.5 * Math.sin(angleRad)).toFixed(2);
          const rot = angleDeg + 90;
          const seatFilled = isOccupied && idx < occupiedCount;
          const fill = seatFilled ? (isVip ? '#B59449' : '#0F6B4E') : '#FFFFFF';
          const stroke = seatFilled ? (isVip ? '#8E7030' : '#0B533C') : (isOccupied ? '#B59449' : '#C9A959');

          const g = document.createElementNS(ns, 'g');
          g.setAttribute('transform', 'translate(' + cx + ' ' + cy + ') rotate(' + rot + ')');

          const back = document.createElementNS(ns, 'rect');
          back.setAttribute('x', '-6');
          back.setAttribute('y', '-5.5');
          back.setAttribute('width', '12');
          back.setAttribute('height', '3.2');
          back.setAttribute('rx', '1.6');
          back.setAttribute('fill', fill);
          back.setAttribute('stroke', stroke);
          back.setAttribute('stroke-width', '1.1');

          const seat = document.createElementNS(ns, 'rect');
          seat.setAttribute('x', '-5');
          seat.setAttribute('y', '-1.5');
          seat.setAttribute('width', '10');
          seat.setAttribute('height', '5.5');
          seat.setAttribute('rx', '2');
          seat.setAttribute('fill', fill);
          seat.setAttribute('stroke', stroke);
          seat.setAttribute('stroke-width', '1.1');

          g.appendChild(back);
          g.appendChild(seat);
          svg.appendChild(g);
        }
        return svg;
      }

      function render() {
        const container = document.getElementById('floor-plan');
        container.innerHTML = '';

        let totalTables = 0;
        let occupiedTables = 0;
        let totalGuests = 0;
        let totalSpareInReserved = 0;
        let vipCount = 0;

        TOLDOS.forEach(function (toldo) {
          if (toldo.type === 'mesas') {
            totalTables += toldo.mesas;
            for (let i = 1; i <= toldo.mesas; i++) {
              const e = state['toldo-' + toldo.id + '-mesa-' + i];
              if (e) {
                const occ = Math.min(SEATS_PER_TABLE, Math.max(1, Number(e.guestsCount || 10)));
                occupiedTables++;
                totalGuests += occ;
                totalSpareInReserved += getRemaining(occ);
                if (e.tag === 'vip' || e.tag === 'honor') vipCount++;
              }
            }
          }
        });

        document.getElementById('summary-line').textContent =
          occupiedTables + ' / ' + totalTables + ' mesas ocupadas  ·  ' +
          totalGuests.toLocaleString('es-ES') + ' / ' + (totalTables * SEATS_PER_TABLE).toLocaleString('es-ES') + ' sillas ocupadas  ·  ' +
          totalSpareInReserved.toLocaleString('es-ES') + ' sillas sobrantes en reservadas  ·  ' +
          vipCount + ' VIP';

        document.querySelectorAll('.filter-btn').forEach(function (btn) {
          const isActive = btn.getAttribute('data-filter') === activeFilter;
          btn.className = 'filter-btn px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ' +
            (isActive ? 'bg-white text-[#1F2421] shadow-sm' : 'text-[#5C635E] hover:text-[#1F2421]');
        });

        TOLDOS.forEach(function (toldo) {
          const section = document.createElement('section');
          section.className = 'print-avoid-break flex flex-col md:flex-row bg-white/95 backdrop-blur-[2px] border border-[#C9A959]/45 rounded-xl overflow-hidden shadow-xl';

          const side = document.createElement('div');
          side.className = 'md:w-52 bg-[#F3EFE6] px-5 py-4 flex flex-col justify-center border-b md:border-b-0 md:border-r border-[#E4DCCE] shrink-0';

          const sideTitle = document.createElement('h2');
          sideTitle.className = 'font-display text-2xl font-bold text-[#1F2421] leading-tight';
          sideTitle.textContent = toldo.name;
          side.appendChild(sideTitle);

          if (toldo.type === 'mesas') {
            let tOcc = 0;
            let tGuests = 0;
            let tSpare = 0;
            for (let i = 1; i <= toldo.mesas; i++) {
              const e = state['toldo-' + toldo.id + '-mesa-' + i];
              if (e) {
                const occ = Math.min(SEATS_PER_TABLE, Math.max(1, Number(e.guestsCount || 10)));
                tOcc++;
                tGuests += occ;
                tSpare += getRemaining(occ);
              }
            }
            const meta1 = document.createElement('p');
            meta1.className = 'mt-1 text-xs font-mono-tab text-[#5C635E]';
            meta1.textContent = tOcc + ' / ' + toldo.mesas + ' mesas';
            const meta2 = document.createElement('p');
            meta2.className = 'text-xs font-mono-tab text-[#5C635E]';
            meta2.textContent = tGuests + ' / ' + toldo.personas + ' sillas ocup.';
            side.appendChild(meta1);
            side.appendChild(meta2);
            if (tSpare > 0) {
              const meta3 = document.createElement('p');
              meta3.className = 'mt-0.5 text-xs font-mono-tab font-medium text-[#B59449]';
              meta3.textContent = tSpare + (tSpare === 1 ? ' silla sobrante' : ' sillas sobrantes');
              side.appendChild(meta3);
            }
          } else {
            const sub = document.createElement('p');
            sub.className = 'mt-1 text-xs text-[#5C635E]';
            sub.textContent = toldo.subtitle || 'Toldo 4 · Grupo musical';
            side.appendChild(sub);
          }

          section.appendChild(side);

          const area = document.createElement('div');
          area.className = 'flex-1 p-4 sm:p-6 flex items-center justify-center';

          if (toldo.type === 'mesas') {
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-5 place-items-center w-full max-w-4xl';

            for (let i = 1; i <= toldo.mesas; i++) {
              const tableId = 'toldo-' + toldo.id + '-mesa-' + i;
              const entry = state[tableId];
              const isOccupied = Boolean(entry);
              const occCount = isOccupied ? Math.min(SEATS_PER_TABLE, Math.max(1, Number(entry.guestsCount || 10))) : 0;
              const remCount = isOccupied ? getRemaining(occCount) : SEATS_PER_TABLE;
              const isVip = isOccupied && (entry.tag === 'vip' || entry.tag === 'honor');
              const isMatch = matches(tableId, i, toldo.name);

              const wrap = document.createElement('div');
              wrap.className = 'relative w-[108px] h-[108px] sm:w-[120px] sm:h-[120px] flex items-center justify-center transition-opacity duration-150 ' + (isMatch ? 'opacity-100' : 'opacity-20');

              wrap.appendChild(createTenChairsSvg(occCount, isOccupied, isVip));

              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'relative z-10 w-[82px] h-[82px] sm:w-[92px] sm:h-[92px] rounded-full flex flex-col items-center justify-center px-2 text-center transition-all duration-150 hover:scale-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0F6B4E] ' +
                (isOccupied
                  ? (isVip
                      ? 'bg-[#0F6B4E] text-white border-2 border-[#C9A959] ring-2 ring-[#C9A959]/45 hover:bg-[#0B533C]'
                      : 'bg-[#0F6B4E] text-white border-2 border-[#0B533C] hover:bg-[#0B533C]')
                  : 'bg-white text-[#1F2421] border-2 border-[#C9A959] hover:bg-[#FBF9F5] hover:border-[#B59449]');

              if (isOccupied) {
                const topRow = document.createElement('span');
                topRow.className = 'text-[9px] sm:text-[10px] font-mono-tab tracking-wide text-white/80 leading-none';
                topRow.textContent = isVip ? ('M' + i + ' · VIP') : ('M' + i);

                const nameEl = document.createElement('span');
                nameEl.className = 'mt-0.5 text-[11px] font-semibold leading-tight line-clamp-2 break-words w-full';
                nameEl.textContent = entry.guestName;

                const spareLabel = remCount === 0 ? 'Completa' : (remCount === 1 ? '1 sobra' : remCount + ' sobran');
                const countEl = document.createElement('span');
                countEl.className = 'mt-1 text-[9px] sm:text-[10px] font-mono-tab leading-none ' + (remCount > 0 ? 'text-[#F3DF9E] font-medium' : 'text-white/80');
                countEl.textContent = occCount + '/10 · ' + spareLabel;

                btn.title = toldo.name + ' · Mesa ' + i + ' — ' + entry.guestName + ' (' + occCount + ' ocupadas, ' + remCount + ' sobrantes)';
                btn.appendChild(topRow);
                btn.appendChild(nameEl);
                btn.appendChild(countEl);
              } else {
                const numEl = document.createElement('span');
                numEl.className = 'font-mono-tab text-base sm:text-lg font-semibold text-[#1F2421] leading-none';
                numEl.textContent = 'M' + i;
                const freeEl = document.createElement('span');
                freeEl.className = 'mt-1 text-[10px] font-medium text-[#5C635E] leading-none';
                freeEl.textContent = '10 sillas';
                btn.title = toldo.name + ' · Mesa ' + i + ' (Libre · 10 sillas)';
                btn.appendChild(numEl);
                btn.appendChild(freeEl);
              }

              btn.addEventListener('click', function () {
                openModal(tableId, toldo.name, i);
              });

              wrap.appendChild(btn);
              grid.appendChild(wrap);
            }
            area.appendChild(grid);
          } else {
            area.innerHTML =
              '<div class="w-full max-w-3xl min-h-[176px] grid grid-cols-1 sm:grid-cols-12 border border-[#B59449]/60 rounded-xl overflow-hidden bg-[#FBF9F5]">' +
                '<div class="sm:col-span-3 bg-[#F3EFE6] border-b sm:border-b-0 sm:border-r border-[#E4DCCE] p-4 flex flex-col items-center justify-center gap-2">' +
                  '<div class="w-14 h-4 bg-white border border-[#C9A959]/70 rounded-sm"></div>' +
                  '<div class="w-12 h-12 rounded-full bg-white border border-[#C9A959] flex items-center justify-center text-[10px] font-medium text-[#5C635E]">Lounge</div>' +
                  '<div class="w-14 h-4 bg-white border border-[#C9A959]/70 rounded-sm"></div>' +
                '</div>' +
                '<div class="sm:col-span-6 gala-wood-floor p-6 flex flex-col items-center justify-center text-center">' +
                  '<span class="font-display text-2xl sm:text-3xl font-bold tracking-[0.14em] text-[#FBF9F5]/90">PISTA DE BAILE</span>' +
                  '<span class="mt-1 text-xs text-[#F3EFE6]/75">Toldo 4 · Zona central</span>' +
                '</div>' +
                '<div class="sm:col-span-3 bg-[#1F2421] text-[#FBF9F5] p-4 flex flex-col items-center justify-center text-center border-t sm:border-t-0 sm:border-l border-[#B59449]/50">' +
                  '<div class="w-14 h-14 rounded-full border border-[#C9A959]/70 flex items-center justify-center text-[11px] font-mono-tab tracking-wider text-[#F3EFE6]">STAGE</div>' +
                  '<span class="mt-2 text-[11px] text-[#F3EFE6]/75">Grupo musical</span>' +
                '</div>' +
              '</div>';
          }

          section.appendChild(area);
          container.appendChild(section);
        });
      }

      const modal = document.getElementById('table-modal');
      const inputName = document.getElementById('guest-name');
      const inputTag = document.getElementById('guest-tag');
      const inputNotes = document.getElementById('guest-notes');
      const formError = document.getElementById('form-error');
      const chairsError = document.getElementById('chairs-error');
      const chairsReadout = document.getElementById('modal-chairs-readout');
      const chairPickerGrid = document.getElementById('chair-picker-grid');
      const btnFree = document.getElementById('btn-free');

      function renderChairPicker() {
        chairPickerGrid.innerHTML = '';
        for (let n = 1; n <= SEATS_PER_TABLE; n++) {
          const btn = document.createElement('button');
          btn.type = 'button';
          const active = selectedChairs === n;
          btn.className = 'h-10 rounded-lg font-mono-tab text-sm font-semibold border transition-colors ' +
            (active
              ? 'bg-[#0F6B4E] text-white border-[#0B533C]'
              : 'bg-white text-[#1F2421] border-[#E4DCCE] hover:border-[#B59449]');
          btn.textContent = String(n);
          btn.addEventListener('click', function () {
            selectedChairs = n;
            chairsError.classList.add('hidden');
            renderChairPicker();
          });
          chairPickerGrid.appendChild(btn);
        }
        if (selectedChairs === null) {
          chairsReadout.textContent = 'Sin seleccionar';
          chairsReadout.className = 'text-xs font-mono-tab text-[#5C635E]';
        } else {
          const rem = getRemaining(selectedChairs);
          chairsReadout.textContent = selectedChairs + ' ocup. · ' + (rem === 0 ? '0 sobran' : (rem === 1 ? 'sobra 1 silla' : 'sobran ' + rem));
          chairsReadout.className = 'text-xs font-mono-tab font-semibold text-[#0F6B4E]';
        }
      }

      function openModal(tableId, toldoName, num) {
        currentTableId = tableId;
        document.getElementById('modal-subtitle').textContent = toldoName + ' · Mesa ' + num + ' · 10 sillas';
        const entry = state[tableId];
        document.getElementById('modal-title').textContent = entry ? 'Editar reserva de mesa' : 'Reservar mesa';
        inputName.value = entry ? entry.guestName : '';
        selectedChairs = entry ? Math.min(SEATS_PER_TABLE, Math.max(1, Number(entry.guestsCount || 10))) : null;
        inputTag.value = entry ? entry.tag : 'estandar';
        inputNotes.value = entry ? (entry.notes || '') : '';
        formError.classList.add('hidden');
        chairsError.classList.add('hidden');
        renderChairPicker();
        if (entry) btnFree.classList.remove('hidden'); else btnFree.classList.add('hidden');
        modal.classList.remove('hidden');
        setTimeout(function () { inputName.focus(); inputName.select(); }, 30);
      }

      function closeModal() {
        modal.classList.add('hidden');
        currentTableId = null;
      }

      document.getElementById('assignment-form').addEventListener('submit', function (e) {
        e.preventDefault();
        if (!currentTableId) return;
        const name = inputName.value.trim();
        if (!name) {
          if (state[currentTableId]) {
            delete state[currentTableId];
            persist();
            render();
            closeModal();
            return;
          }
          formError.textContent = 'Ingresa el nombre del invitado o familia.';
          formError.classList.remove('hidden');
          inputName.focus();
          return;
        }
        if (selectedChairs === null || selectedChairs < 1 || selectedChairs > SEATS_PER_TABLE) {
          chairsError.textContent = 'Indica cuántas sillas se ocuparán en esta mesa (1 a 10).';
          chairsError.classList.remove('hidden');
          return;
        }
        state[currentTableId] = {
          guestName: name,
          guestsCount: selectedChairs,
          tag: inputTag.value || 'estandar',
          notes: inputNotes.value.trim(),
          updatedAt: Date.now()
        };
        persist();
        render();
        closeModal();
      });

      btnFree.addEventListener('click', function () {
        if (!currentTableId) return;
        delete state[currentTableId];
        persist();
        render();
        closeModal();
      });

      document.getElementById('modal-close').addEventListener('click', closeModal);
      document.getElementById('btn-cancel').addEventListener('click', closeModal);
      document.getElementById('modal-backdrop').addEventListener('click', closeModal);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
      });

      document.getElementById('search-input').addEventListener('input', function (e) {
        searchQuery = e.target.value.trim();
        render();
      });

      document.querySelectorAll('.filter-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          activeFilter = btn.getAttribute('data-filter');
          render();
        });
      });

      document.getElementById('btn-print').addEventListener('click', function () {
        window.print();
      });

      document.getElementById('btn-export-csv').addEventListener('click', function () {
        const rows = [['Toldo', 'Mesa', 'Estado', 'Invitado o Familia', 'Sillas ocupadas', 'Sillas sobrantes', 'Etiqueta', 'Notas'].join(',')];
        function esc(v) {
          const s = String(v);
          return /[",\\n\\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }
        TOLDOS.forEach(function (toldo) {
          if (toldo.type !== 'mesas') return;
          for (let i = 1; i <= toldo.mesas; i++) {
            const e = state['toldo-' + toldo.id + '-mesa-' + i];
            if (e) {
              const occ = Math.min(SEATS_PER_TABLE, Math.max(1, Number(e.guestsCount || 10)));
              rows.push([toldo.name, 'Mesa ' + i, 'Reservada', e.guestName, occ, getRemaining(occ), TAG_LABELS[e.tag] || 'Estándar', e.notes || ''].map(esc).join(','));
            } else {
              rows.push([toldo.name, 'Mesa ' + i, 'Libre', '', 0, SEATS_PER_TABLE, '', ''].map(esc).join(','));
            }
          }
        });
        const blob = new Blob(['\\uFEFF' + rows.join('\\r\\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'distribucion-mesas.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });

      render();
    })();
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  triggerFileDownload(blob, 'plano-de-gala-mesas.html');
}
