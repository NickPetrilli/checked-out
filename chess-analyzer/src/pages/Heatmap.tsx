import { useState } from 'react';
import { Chess } from 'chess.js';
import HeatmapGrid from '../components/HeatmapGrid';
import { useChessGames } from '../hooks/useChessGames';
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
  const { games, loading, error, fetchGames } = useChessGames();
  const [username, setUsername] = useState('');
  const [heatmap, setHeatmap] = useState<Partial<HeatmapData>>({});

  function handleGenerate() {
    if (!username) return;
    fetchGames(username, 3).then(() => {});
  }

  function handleBuild() {
    setHeatmap(buildHeatmap(games.map((g) => g.pgn)));
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <h2 className="text-2xl font-semibold text-gray-800">Move Heatmap</h2>
      <p className="text-gray-500 text-sm">
        See which squares are visited most often across your recent games.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Chess.com username"
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !username}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Loading...' : 'Fetch Games'}
        </button>
        <button
          onClick={handleBuild}
          disabled={games.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          Build Heatmap
        </button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {games.length > 0 && (
        <p className="text-gray-400 text-xs">{games.length} games loaded</p>
      )}

      <HeatmapGrid data={heatmap} />
    </div>
  );
}
