import { Music } from 'lucide-react';

export function DanceFloorToldo() {
  return (
    <section
      id="toldo-4"
      aria-label="Toldo 4: Pista de baile y grupo musical"
      className="print-avoid-break flex flex-col md:flex-row bg-white/95 backdrop-blur-[2px] border border-[#C9A959]/45 rounded-xl overflow-hidden shadow-[0_12px_32px_-16px_rgba(0,0,0,0.65)] scroll-mt-28"
    >
      {/* Left architectural sidebar */}
      <div className="md:w-52 bg-[#F3EFE6] px-5 py-5 flex flex-col justify-center border-b md:border-b-0 md:border-r border-[#E4DCCE] shrink-0">
        <span className="font-mono text-xs text-[#B59449] font-medium">
          Toldo 4
        </span>
        <h2 className="font-display text-2xl font-bold text-[#1F2421] leading-tight mt-0.5">
          PISTA DE BAILE
        </h2>
        <p className="mt-1.5 text-xs text-[#5C635E]">
          Grupo musical · Lounge
        </p>
      </div>

      {/* Main Dance Floor Blueprint */}
      <div className="flex-1 p-5 sm:p-7 flex items-center justify-center bg-[#FBF9F5]/40">
        <div className="w-full max-w-3xl min-h-[180px] grid grid-cols-1 sm:grid-cols-12 border border-[#B59449]/70 rounded-xl overflow-hidden bg-[#FBF9F5]">
          {/* Lounge Area Left */}
          <div className="sm:col-span-3 bg-[#F3EFE6] border-b sm:border-b-0 sm:border-r border-[#E4DCCE] p-4 flex flex-col items-center justify-center gap-2.5">
            <div className="w-16 h-4 bg-white border border-[#C9A959]/70 rounded-sm" />
            <div className="w-14 h-14 rounded-full bg-white border border-[#C9A959] flex items-center justify-center text-[11px] font-medium text-[#5C635E]">
              Lounge
            </div>
            <div className="w-16 h-4 bg-white border border-[#C9A959]/70 rounded-sm" />
          </div>

          {/* Dance Floor Center */}
          <div className="sm:col-span-6 gala-wood-floor p-6 flex flex-col items-center justify-center text-center relative">
            <div className="border border-[#C9A959]/40 px-5 py-3 rounded-lg bg-[#1F2421]/25 backdrop-blur-[1px]">
              <div className="font-display text-2xl sm:text-3xl font-bold tracking-[0.14em] text-[#FBF9F5]">
                PISTA DE BAILE
              </div>
              <div className="mt-1 text-xs text-[#F3EFE6]/85">
                Eje central del salón
              </div>
            </div>
          </div>

          {/* Stage Right */}
          <div className="sm:col-span-3 bg-[#1F2421] text-[#FBF9F5] p-4 flex flex-col items-center justify-center text-center border-t sm:border-t-0 sm:border-l border-[#B59449]/50 relative overflow-hidden">
            {/* Subtle acoustic arcs */}
            <svg
              viewBox="0 0 120 120"
              aria-hidden="true"
              className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
            >
              <circle
                cx="115"
                cy="60"
                r="42"
                fill="none"
                stroke="#C9A959"
                strokeWidth="1"
              />
              <circle
                cx="115"
                cy="60"
                r="68"
                fill="none"
                stroke="#C9A959"
                strokeWidth="1"
              />
              <circle
                cx="115"
                cy="60"
                r="94"
                fill="none"
                stroke="#C9A959"
                strokeWidth="0.75"
              />
            </svg>
            <div className="relative z-10 w-14 h-14 rounded-full border border-[#C9A959]/80 bg-[#1F2421]/80 flex flex-col items-center justify-center">
              <Music className="w-4 h-4 text-[#C9A959] mb-0.5" aria-hidden="true" />
              <span className="font-mono text-[10px] tracking-wider text-[#F3EFE6]">
                STAGE
              </span>
            </div>
            <span className="relative z-10 mt-2 text-[11px] text-[#F3EFE6]/80">
              Grupo musical
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
