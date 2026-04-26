import { useState } from 'react';
import { Chess } from 'chess.js';
import HeatmapGrid from '../components/HeatmapGrid';
import { useChessGamesContext } from '../context/ChessGamesContext';
import type { HeatmapData, Square } from '../types/chess';

function buildHeatmap(pgns: string[]): Partial<HeatmapData> {
  const counts: Partial<HeatmapData> = {};
  for (const pgn of pgns) {
    const chess = new Chess();
    try {
      chess.loadPgn(pgn);
      for (const move of chess.history({ verbose: true })) {
        const sq = move.to as Square;
        counts[sq] = (counts[sq] ?? 0) + 1;
      }
    } catch {
      // skip malformed PGNs
    }
  }
  return counts;
}

export default function Heatmap() {
  const { games, loading, error } = useChessGamesContext();
  const [heatmap, setHeatmap] = useState<Partial<HeatmapData>>({});

  function handleBuild() {
    setHeatmap(buildHeatmap(games.map((g) => g.pgn)));
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white">Move Heatmap</h2>
        <p className="text-gray-400 text-sm mt-1">
          See which squares are visited most often across your loaded games.
        </p>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading games…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && games.length === 0 && !error && (
        <p className="text-gray-500 text-sm">Fetch games on the Home page first.</p>
      )}

      {games.length > 0 && (
        <>
          <p className="text-gray-400 text-xs">{games.length} games available</p>
          <button
            onClick={handleBuild}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            Build Heatmap
          </button>
        </>
      )}

      <HeatmapGrid data={heatmap} />
    </div>
  );
}
