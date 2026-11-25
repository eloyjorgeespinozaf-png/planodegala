import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileCode2, FileSpreadsheet, Printer } from 'lucide-react';
import { ActiveView } from '../types/seating';

interface TopBarProps {
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  onExportHTML: () => void;
  onExportCSV: () => void;
  onPrint: () => void;
}

const BANNER_IMAGE_SRC = '/assets/aistudio/image_2e94d0ae.png';
const BRAND_IMAGE_SRC = '/assets/aistudio/image_b65aae5b.png';

const NAV_ITEMS: { id: ActiveView; label: string }[] = [
  { id: 'plano', label: 'Plano' },
  { id: 'invitados', label: 'Invitados' },
  { id: 'resumen', label: 'Resumen' },
];

export function TopBar({
  activeView,
  onChangeView,
  onExportHTML,
  onExportCSV,
  onPrint,
}: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [brandImgError, setBrandImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 bg-[#0A0B0A] border-b border-[#C9A959]/55 shadow-[0_8px_28px_-14px_rgba(10,11,10,0.75)] no-print">
      {/* Ceremonial banner background spanning from Plano de Gala to Exportar */}
      <div
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden pointer-events-none"
      >
        {!imgError ? (
          <>
            {/* Ambient full-bleed warm gold extension */}
            <img
              src={BANNER_IMAGE_SRC}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="absolute inset-0 w-full h-full object-cover object-center opacity-30 blur-[2px] scale-105"
            />
            {/* Crisp focal ceremonial artwork across the container span */}
            <div className="relative max-w-7xl mx-auto h-full">
              <img
                src={BANNER_IMAGE_SRC}
                alt="Acto de Egreso — Escuela de Comando y Estado Mayor del Ejército"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover object-[center_46%] opacity-80"
              />
              {/* Soft lateral vignette blending edges into obsidian */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#0A0B0A] via-transparent to-[#0A0B0A]" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0B0A] via-[#1B170E] to-[#0A0B0A]" />
        )}

        {/* Measured contrast scrim ensuring WCAG AA+ legibility across every zone */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0B0A]/90 via-[#0A0B0A]/58 to-[#0A0B0A]/90" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0B0A]/65 via-[#0A0B0A]/30 to-[#0A0B0A]/75" />
        {/* Fine ceremonial top gold accent line */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4B45E]/60 to-transparent" />
      </div>

      {/* Three-zone top bar contract */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 h-20 sm:h-24 flex items-center justify-between gap-6 sm:gap-8">
        {/* Zone 1: Ceremonial brand emblem image replacing Plano de Gala */}
        <button
          type="button"
          onClick={() => onChangeView('plano')}
          aria-label="Acto de Egreso — Ir al plano"
          className="flex items-center shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4B45E] transition-transform duration-150 hover:scale-[1.02]"
        >
          {!brandImgError ? (
            <span className="block h-14 w-[72px] sm:h-[76px] sm:w-[98px] overflow-hidden rounded-lg border border-[#D4B45E]/75 bg-[#0E0B07] shadow-[0_4px_16px_rgba(0,0,0,0.75)]">
              <img
                src={BRAND_IMAGE_SRC}
                alt="Escuela de Comando y Estado Mayor del Ejército — Acto de Egreso"
                referrerPolicy="no-referrer"
                onError={() => setBrandImgError(true)}
                className="w-full h-full object-cover object-[50%_46%] scale-[1.18]"
              />
            </span>
          ) : (
            <span className="font-display text-2xl sm:text-[30px] font-bold tracking-wide text-[#FBF9F5] whitespace-nowrap">
              Plano de Gala
            </span>
          )}
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Vistas principales"
          className="flex items-center gap-5 sm:gap-9"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeView(item.id)}
                className={`relative py-2 text-sm font-semibold tracking-wide whitespace-nowrap shrink-0 drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4B45E] rounded ${
                  isActive
                    ? 'text-[#F1D68A]'
                    : 'text-[#F5F0E4]/90 hover:text-white'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 right-0 -bottom-[22px] sm:-bottom-[30px] h-[2px] bg-[#D4B45E] shadow-[0_0_8px_rgba(212,180,94,0.65)]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action with export menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-[#FBF9F5] bg-[#0F6B4E] hover:bg-[#13825F] border border-[#D4B45E]/80 hover:border-[#F1D68A] shadow-[0_2px_12px_rgba(0,0,0,0.5)] rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0B0A] focus-visible:ring-[#D4B45E]"
          >
            <Download className="w-4 h-4 shrink-0 text-[#F1D68A]" aria-hidden="true" />
            <span>Exportar</span>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
                menuOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2.5 w-64 bg-white border border-[#E4DCCE] rounded-xl shadow-xl py-1.5 z-40"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onExportHTML();
                }}
                className="w-full px-4 py-2.5 text-left hover:bg-[#FBF9F5] transition-colors flex items-start gap-3"
              >
                <FileCode2
                  className="w-4 h-4 text-[#0F6B4E] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <div className="text-sm font-semibold text-[#1F2421] whitespace-nowrap">
                    Descargar HTML único
                  </div>
                  <div className="text-xs text-[#5C635E] mt-0.5">
                    Archivo independiente con tus mesas actuales
                  </div>
                </div>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onExportCSV();
                }}
                className="w-full px-4 py-2.5 text-left hover:bg-[#FBF9F5] transition-colors flex items-start gap-3"
              >
                <FileSpreadsheet
                  className="w-4 h-4 text-[#B59449] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <div className="text-sm font-semibold text-[#1F2421] whitespace-nowrap">
                    Exportar CSV (Excel)
                  </div>
                  <div className="text-xs text-[#5C635E] mt-0.5">
                    Listado completo de las 105 mesas
                  </div>
                </div>
              </button>

              <div className="my-1 border-t border-[#E4DCCE]" />

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onPrint();
                }}
                className="w-full px-4 py-2.5 text-left hover:bg-[#FBF9F5] transition-colors flex items-start gap-3"
              >
                <Printer
                  className="w-4 h-4 text-[#5C635E] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <div className="text-sm font-semibold text-[#1F2421] whitespace-nowrap">
                    Imprimir plano
                  </div>
                  <div className="text-xs text-[#5C635E] mt-0.5">
                    Formato horizontal listo para papel o PDF
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
