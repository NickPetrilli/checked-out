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
      <div
        className="w-10 h-10 border-4 rounded-full animate-spin"
        style={{ borderColor: 'var(--bg-surface)', borderTopColor: 'var(--brand-green)' }}
      />
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
    <main
      className="flex flex-col items-center justify-start min-h-[calc(100vh-52px)] px-4 py-16 gap-10"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Hero */}
      <div className="text-center flex flex-col items-center gap-3">
        <div className="text-6xl select-none" aria-hidden="true">♟</div>
        <h1 className="text-5xl font-extrabold tracking-tight" style={{ color: 'var(--text-accent)' }}>
          Chess Analyzer
        </h1>
        <p className="text-lg max-w-md" style={{ color: 'var(--text-secondary)' }}>
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
            className="flex-1 rounded-lg px-4 py-2.5 text-sm focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text-primary)',
            }}
          />
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="rounded-lg px-3 py-2.5 text-sm focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text-primary)',
            }}
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
          className="btn-primary w-full py-2.5 text-sm"
        >
          {loading ? 'Fetching…' : 'Fetch Games'}
        </button>
      </div>

      {loading && <Spinner />}

      {!loading && error && (
        <div
          className="w-full max-w-md rounded-lg px-4 py-3 text-sm"
          style={{
            backgroundColor: 'rgba(204,50,50,0.15)',
            border: '1px solid rgba(204,50,50,0.4)',
            color: 'var(--move-blunder)',
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && summary && (
        <div className="w-full max-w-md flex flex-col gap-4">
          {/* Summary card */}
          <div
            className="rounded-xl p-5 flex flex-col gap-4"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Games loaded for</span>
              <span className="font-semibold" style={{ color: 'var(--text-accent)' }}>{loadedUsername}</span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <StatPill label="Total"  value={summary.total}  color="var(--text-accent)"      />
              <StatPill label="Wins"   value={summary.wins}   color="var(--brand-green)"       />
              <StatPill label="Losses" value={summary.losses} color="var(--move-blunder)"      />
              <StatPill label="Draws"  value={summary.draws}  color="var(--move-inaccuracy)"   />
            </div>

            <div className="text-xs text-center" style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>
              {summary.earliest} &rarr; {summary.latest}
            </div>
          </div>

          {/* CTA */}
          <div className="flex gap-3">
            <Link
              to="/analyzer"
              className="btn-primary flex-1 text-center py-2.5 text-sm"
            >
              Analyze a Game
            </Link>
            <Link
              to="/heatmap"
              className="btn-secondary flex-1 text-center py-2.5 text-sm"
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
    <div
      className="rounded-lg py-2 px-1 flex flex-col items-center gap-0.5"
      style={{ backgroundColor: 'var(--bg-tertiary)' }}
    >
      <span className="text-xl font-bold" style={{ color }}>{value}</span>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}
