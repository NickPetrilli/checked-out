import type { HeatmapData, Square } from '../types/chess';

interface HeatmapGridProps {
  data?: Partial<HeatmapData>;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

function heatColor(value: number, max: number): string {
  if (max === 0) return 'rgb(240,240,240)';
  const intensity = Math.round((value / max) * 255);
  return `rgb(${255 - intensity}, ${255 - intensity}, 255)`;
}

export default function HeatmapGrid({ data = {} }: HeatmapGridProps) {
  const max = Math.max(0, ...Object.values(data));

  return (
    <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: 'repeat(8, 2.5rem)' }}>
      {RANKS.flatMap((rank) =>
        FILES.map((file) => {
          const square = `${file}${rank}` as Square;
          const value = data[square] ?? 0;
          return (
            <div
              key={square}
              title={`${square}: ${value}`}
              className="w-10 h-10 flex items-center justify-center text-xs font-mono"
              style={{ backgroundColor: heatColor(value, max) }}
            >
              {value > 0 ? value : ''}
            </div>
          );
        })
      )}
    </div>
  );
}
