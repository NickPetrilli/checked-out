import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useChessGamesContext } from '../context/ChessGamesContext';
import type { ParsedGame } from '../types/chess';

const MONTH_OPTIONS = [1, 3, 6, 12] as const;

function computeSummary(games: ParsedGame[], username: string) {
  if (games.length === 0) return null;

  let wins = 0, losses = 0, draws = 0;
  const lower = username.toLowerCase();

  for (const g of games) {
    const playingWhite = g.white.toLowerCase() === lower;
    if (g.result === 'draw') {
      draws++;
    } else if ((g.result === 'white') === playingWhite) {
      wins++;
    } else {
      losses++;
    }
  }

  const dates = games.map((g) => g.date).sort();
  return {
    total: games.length,
    wins,
    losses,
    draws,
    earliest: dates[0],
    latest: dates[dates.length - 1],
  };
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="w-10 h-10 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

export default function Home() {
  const { games, loading, error, username: loadedUsername, fetchGames } = useChessGamesContext();
  const [inputUsername, setInputUsername] = useState(loadedUsername);
  const [months, setMonths] = useState<number>(1);

  function handleFetch() {
    if (!inputUsername.trim()) return;
    fetchGames(inputUsername.trim(), months);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleFetch();
  }

  const summary = computeSummary(games, loadedUsername || inputUsername);

  return (
    <main className="flex flex-col items-center justify-start min-h-[calc(100vh-57px)] px-4 py-16 gap-10">

      {/* Hero */}
      <div className="text-center flex flex-col items-center gap-3">
        <div className="text-6xl select-none">♟</div>
        <h1 className="text-5xl font-extrabold tracking-tight text-white">Chess Analyzer</h1>
        <p className="text-gray-400 text-lg max-w-md">
          Load your Chess.com games, replay moves, and explore board heatmaps.
        </p>
      </div>

      {/* Fetch form */}
      <div className="w-full max-w-md flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputUsername}
            onChange={(e) => setInputUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Chess.com username"
            className="flex-1 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? 'month' : 'months'}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleFetch}
          disabled={loading || !inputUsername.trim()}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
        >
          {loading ? 'Fetching…' : 'Fetch Games'}
        </button>
      </div>

      {/* States */}
      {loading && <Spinner />}

      {!loading && error && (
        <div className="w-full max-w-md bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && summary && (
        <div className="w-full max-w-md flex flex-col gap-4">
          {/* Summary card */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <span className="text-gray-400 text-sm">Games loaded for</span>
              <span className="text-white font-semibold">{loadedUsername}</span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <StatPill label="Total" value={summary.total} color="text-white" />
              <StatPill label="Wins" value={summary.wins} color="text-green-400" />
              <StatPill label="Losses" value={summary.losses} color="text-red-400" />
              <StatPill label="Draws" value={summary.draws} color="text-yellow-400" />
            </div>

            <div className="text-xs text-gray-500 text-center">
              {summary.earliest} &rarr; {summary.latest}
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex gap-3">
            <Link
              to="/analyzer"
              className="flex-1 text-center py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              Analyze a Game
            </Link>
            <Link
              to="/heatmap"
              className="flex-1 text-center py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              View Heatmap
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-900 rounded-lg py-2 px-1 flex flex-col items-center gap-0.5">
      <span className={`text-xl font-bold ${color}`}>{value}</span>
      <span className="text-gray-500 text-xs">{label}</span>
    </div>
  );
}
