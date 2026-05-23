import { useState, useRef } from 'react';
import type { HeatmapData, Square } from '../types/chess';

// ── Constants ─────────────────────────────────────────────────────────────────

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;
const CELL = 56; // px

// Light/dark square base colors (subtle warm chessboard, works on dark bg)
const LIGHT_SQ = '#3a3120';
const DARK_SQ  = '#1e1a10';

// ── Color helpers ─────────────────────────────────────────────────────────────

/**
 * Returns an hsla colour on the blue → cyan → green → yellow → red spectrum.
 * 0 count = transparent; max count = fully saturated red.
 */
function heatColor(value: number, max: number): string {
  if (value === 0 || max === 0) return 'transparent';
  const t = value / max;
  const hue  = Math.round(240 * (1 - t));   // 240 (blue) → 0 (red)
  const light = 42 + t * 13;                 // slightly brighter at peak
  const alpha = 0.30 + t * 0.70;             // 30 % → 100 %
  return `hsla(${hue}, 88%, ${light}%, ${alpha})`;
}

/** CSS gradient string for the legend bar. */
const LEGEND_GRADIENT =
  'linear-gradient(to right, hsla(240,88%,42%,1), hsla(180,88%,45%,1), hsla(120,88%,45%,1), hsla(60,88%,50%,1), hsla(0,88%,50%,1))';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TooltipState {
  square: Square;
  count: number;
  x: number;
  y: number;
}

interface HeatmapGridProps {
  data: Partial<HeatmapData>;
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ max }: { max: number }) {
  return (
    <div className="flex flex-col gap-1" style={{ width: CELL * 8 + 20 }}>
      <div
        className="h-3 rounded"
        style={{ background: LEGEND_GRADIENT, marginLeft: 20 }}
      />
      <div className="flex justify-between text-xs" style={{ marginLeft: 20, color: 'var(--text-secondary)' }}>
        <span>0</span>
        <span>{max > 0 ? Math.round(max / 2) : '—'}</span>
        <span>{max > 0 ? max : '—'}</span>
      </div>
    </div>
  );
}

// ── Grid ──────────────────────────────────────────────────────────────────────

export default function HeatmapGrid({ data }: HeatmapGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const max = Math.max(0, ...Object.values(data));

  function handleEnter(e: React.MouseEvent, square: Square, count: number) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const origin = containerRef.current?.getBoundingClientRect();
    if (!origin) return;
    setTooltip({
      square,
      count,
      x: rect.left - origin.left + rect.width / 2,
      y: rect.top - origin.top,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Board */}
      <div ref={containerRef} className="relative select-none">
        {/* Rows */}
        {RANKS.map((rank, rankIdx) => (
          <div key={rank} className="flex">
            {/* Rank label */}
            <div
              className="flex items-center justify-center text-xs shrink-0"
              style={{ color: 'var(--text-secondary)', width: 20, height: CELL }}
            >
              {rank}
            </div>

            {/* Squares */}
            {FILES.map((file, fileIdx) => {
              const square = `${file}${rank}` as Square;
              const count = data[square] ?? 0;
              const isLight = (fileIdx + rankIdx) % 2 === 0;

              return (
                <div
                  key={square}
                  className="relative cursor-crosshair"
                  style={{ width: CELL, height: CELL }}
                  onMouseEnter={(e) => handleEnter(e, square, count)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* Chessboard base */}
                  <div
                    className="absolute inset-0"
                    style={{ backgroundColor: isLight ? LIGHT_SQ : DARK_SQ }}
                  />
                  {/* Heat overlay */}
                  <div
                    className="absolute inset-0 transition-colors duration-150"
                    style={{ backgroundColor: heatColor(count, max) }}
                  />
                </div>
              );
            })}
          </div>
        ))}

        {/* File labels */}
        <div className="flex" style={{ paddingLeft: 20 }}>
          {FILES.map((file) => (
            <div
              key={file}
              className="flex items-center justify-center text-xs"
              style={{ color: 'var(--text-secondary)', width: CELL }}
            >
              {file}
            </div>
          ))}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-20 px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none shadow-lg"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-primary)',
              left: tooltip.x,
              top: tooltip.y - 4,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <span className="font-mono font-semibold">{tooltip.square}</span>
            {' — '}
            <span>{tooltip.count.toLocaleString()} move{tooltip.count !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <Legend max={max} />
    </div>
  );
}
