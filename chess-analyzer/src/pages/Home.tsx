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

// ── Animated background chess pieces ────────────────────────────────────────

const FLOATING_PIECES = [
  { symbol: '♟', size: 88,  top: '8%',  left: '4%',   opacity: 0.18, delay: '0s',   duration: '9s',  color: '#e8d5b0' },
  { symbol: '♞', size: 108, top: '12%', left: '87%',  opacity: 0.16, delay: '-4s',  duration: '11s', color: '#d4a843' },
  { symbol: '♝', size: 70,  top: '62%', left: '2%',   opacity: 0.13, delay: '-7s',  duration: '10s', color: '#e8d5b0' },
  { symbol: '♜', size: 92,  top: '75%', left: '91%',  opacity: 0.15, delay: '-2s',  duration: '8s',  color: '#d4a843' },
  { symbol: '♛', size: 130, top: '18%', left: '44%',  opacity: 0.09, delay: '-9s',  duration: '13s', color: '#c8b88a' },
  { symbol: '♚', size: 78,  top: '52%', left: '77%',  opacity: 0.14, delay: '-5s',  duration: '9s',  color: '#e8d5b0' },
  { symbol: '♙', size: 58,  top: '33%', left: '18%',  opacity: 0.14, delay: '-6s',  duration: '8s',  color: '#d4a843' },
  { symbol: '♘', size: 96,  top: '82%', left: '38%',  opacity: 0.11, delay: '-1s',  duration: '12s', color: '#e8d5b0' },
  { symbol: '♗', size: 72,  top: '4%',  left: '63%',  opacity: 0.16, delay: '-8s',  duration: '10s', color: '#d4a843' },
  { symbol: '♖', size: 84,  top: '44%', left: '56%',  opacity: 0.09, delay: '-3s',  duration: '14s', color: '#c8b88a' },
];

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  left:     `${(i * 4.55 + 3) % 97}%`,
  size:     2.5 + (i % 3) * 1.5,
  delay:    `-${(i * 1.9) % 14}s`,
  duration: `${9 + (i % 7)}s`,
  color:    i % 3 === 0
    ? 'rgba(212,168,67,0.5)'
    : i % 3 === 1
      ? 'rgba(82,176,68,0.45)'
      : 'rgba(232,213,176,0.35)',
  bottom:   `${(i * 7) % 30}%`,
}));

function AnimatedHeroBg() {
  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      {/* Radial gradient lighting */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(ellipse 80% 60% at 50% 30%, rgba(82,176,68,0.08) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 70% 70%, rgba(212,168,67,0.07) 0%, transparent 50%)
        `,
      }} />

      {/* Receding board grid at bottom */}
      <div style={{
        position: 'absolute',
        bottom: '-20%',
        left: '-50%',
        right: '-50%',
        height: '65%',
        backgroundImage: `
          linear-gradient(rgba(212,168,67,0.09) 1px, transparent 1px),
          linear-gradient(90deg, rgba(212,168,67,0.09) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        transform: 'perspective(500px) rotateX(60deg)',
        transformOrigin: 'center bottom',
        maskImage: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 100%)',
        animation: 'board-grid-in 1.2s ease-out both',
      }} />

      {/* Ambient glow orbs */}
      <div style={{
        position: 'absolute', top: '-10%', left: '15%',
        width: 480, height: 480, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(82,176,68,0.07) 0%, transparent 70%)',
        filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '10%',
        width: 360, height: 360, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,168,67,0.08) 0%, transparent 70%)',
        filter: 'blur(50px)',
      }} />

      {/* Floating chess pieces */}
      {FLOATING_PIECES.map((piece, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: piece.top,
            left: piece.left,
            fontSize: piece.size,
            lineHeight: 1,
            opacity: piece.opacity,
            color: piece.color,
            animation: `piece-float ${piece.duration} ease-in-out infinite`,
            animationDelay: piece.delay,
            filter: `drop-shadow(0 0 10px ${piece.color}60)`,
            userSelect: 'none',
          }}
        >
          {piece.symbol}
        </div>
      ))}

      {/* Rising particles */}
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.left,
            bottom: p.bottom,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: p.color,
            animation: `particle-rise ${p.duration} ease-in infinite`,
            animationDelay: p.delay,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
        />
      ))}

      {/* Top vignette */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 100,
        background: 'linear-gradient(to bottom, var(--bg-primary) 0%, transparent 100%)',
      }} />
      {/* Bottom vignette */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
        background: 'linear-gradient(to top, var(--bg-primary) 0%, transparent 100%)',
      }} />
    </div>
  );
}

// ── Feature badge ────────────────────────────────────────────────────────────

function FeatureBadge({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-default select-none"
      style={{
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: `1px solid ${color}30`,
        color: 'var(--text-secondary)',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = `${color}12`;
        (e.currentTarget as HTMLDivElement).style.borderColor = `${color}60`;
        (e.currentTarget as HTMLDivElement).style.color = 'var(--text-primary)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255,255,255,0.04)';
        (e.currentTarget as HTMLDivElement).style.borderColor = `${color}30`;
        (e.currentTarget as HTMLDivElement).style.color = 'var(--text-secondary)';
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }}
      />
      {label}
    </div>
  );
}

// ── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color,
  delay,
}: {
  label: string;
  value: number;
  color: string;
  delay: string;
}) {
  return (
    <div
      className="stat-appear rounded-xl py-3 px-2 flex flex-col items-center gap-1"
      style={{
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        animationDelay: delay,
        flex: 1,
      }}
    >
      <span
        className="text-2xl font-bold tabular-nums leading-none"
        style={{ color, textShadow: `0 0 20px ${color}50` }}
      >
        {value}
      </span>
      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
    </div>
  );
}

// ── Right-panel empty state ───────────────────────────────────────────────────

function RightPanelEmpty() {
  return (
    <div
      className="glass-card flex flex-col items-center justify-center gap-4 text-center h-full"
      style={{
        minHeight: 220,
        padding: '32px 24px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          fontSize: 40,
          opacity: 0.25,
          filter: 'drop-shadow(0 0 12px rgba(212,168,67,0.3))',
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        ♟
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)', opacity: 0.7 }}>
          Your stats will appear here
        </p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.5, lineHeight: 1.6 }}>
          Enter a Chess.com username and click<br />
          Load My Games to get started.
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  const {
    games,
    loading,
    error,
    username: loadedUsername,
    fetchGames,
  } = useChessGamesContext();
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
  const hasGames = !loading && !error && summary;

  return (
    <main
      className="wood-grain relative flex flex-col items-center px-4"
      style={{
        minHeight: 'calc(100vh - 60px)',
        backgroundColor: 'var(--bg-primary)',
        overflow: 'hidden',
        paddingTop: 40,
        paddingBottom: 32,
        gap: 28,
      }}
    >
      <AnimatedHeroBg />

      {/* ── Hero Section ─────────────────────────────────────────── */}
      <section className="relative z-10 text-center flex flex-col items-center gap-5 max-w-2xl w-full">
        {/* Crown icon with glow halo */}
        <div className="relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
          <div style={{
            position: 'absolute', inset: -8, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(82,176,68,0.25) 0%, transparent 70%)',
            animation: 'glow-pulse 3s ease-in-out infinite',
          }} />
          <div
            className="flex items-center justify-center w-full h-full rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(82,176,68,0.18) 0%, rgba(82,176,68,0.06) 100%)',
              border: '1px solid rgba(82,176,68,0.28)',
              boxShadow: '0 4px 24px rgba(82,176,68,0.22), 0 1px 0 rgba(255,255,255,0.06) inset',
              fontSize: 34,
              lineHeight: 1,
            }}
            aria-hidden="true"
          >
            ♚
          </div>
        </div>

        {/* Title + subtitle */}
        <div className="flex flex-col gap-2">
          <h1
            className="font-extrabold tracking-tight leading-none"
            style={{ fontSize: 'clamp(2.4rem, 5.5vw, 3.6rem)', letterSpacing: '-0.04em' }}
          >
            <span className="text-shimmer">Chess Analyzer</span>
          </h1>
          <p
            className="text-base leading-relaxed max-w-md mx-auto"
            style={{ color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}
          >
            Load your Chess.com games, replay every move, and uncover patterns with AI-powered insights.
          </p>
        </div>

        {/* Feature badges */}
        <div className="flex flex-wrap gap-2 justify-center">
          <FeatureBadge label="Stockfish 18 Engine"  color="#52b044" />
          <FeatureBadge label="AI Move Coach"        color="#d4a843" />
          <FeatureBadge label="Board Heatmaps"       color="#5c8bb0" />
          <FeatureBadge label="Play vs Bot"          color="#b044a8" />
        </div>
      </section>

      {/* ── Two-column content area ───────────────────────────────── */}
      <div
        className="relative z-10 w-full grid gap-4"
        style={{
          maxWidth: 920,
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        }}
      >
        {/* Left: Fetch Form */}
        <div
          className="glass-card p-6 flex flex-col gap-4"
          style={{
            boxShadow: '0 0 0 1px rgba(212,168,67,0.09), 0 20px 60px rgba(0,0,0,0.6)',
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="chess-username"
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-secondary)', letterSpacing: '0.1em' }}
            >
              Chess.com Username
            </label>

            <div className="flex gap-2">
              <input
                id="chess-username"
                type="text"
                value={inputUsername}
                onChange={(e) => setInputUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your username…"
                className="input-premium flex-1 px-4 py-2.5 text-sm"
              />
              <select
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="input-premium px-3 py-2.5 text-sm cursor-pointer"
                aria-label="Time period"
                style={{ minWidth: 106 }}
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} {m === 1 ? 'month' : 'months'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleFetch}
            disabled={loading || !inputUsername.trim()}
            className="btn-primary w-full py-3 text-sm"
            style={{ borderRadius: 10, fontSize: 14, fontWeight: 700 }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  style={{
                    width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    animation: 'spin 0.7s linear infinite',
                    display: 'inline-block',
                  }}
                />
                Fetching Games…
              </span>
            ) : (
              'Load My Games'
            )}
          </button>

          {/* Error */}
          {!loading && error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                backgroundColor: 'rgba(204,50,50,0.1)',
                border: '1px solid rgba(204,50,50,0.3)',
                color: 'var(--move-blunder)',
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          <p className="text-center text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.45 }}>
            Fetches public game data from the Chess.com API
          </p>
        </div>

        {/* Right: Stats or empty state */}
        {hasGames ? (
          <div
            className="glass-card stat-appear flex flex-col gap-4 p-6"
            style={{
              boxShadow: '0 0 0 1px rgba(212,168,67,0.09), 0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: 'var(--brand-green)',
                    boxShadow: '0 0 8px var(--brand-green-glow)',
                    animation: 'glow-pulse 2s ease-in-out infinite',
                  }}
                />
                <span
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--text-secondary)', letterSpacing: '0.1em' }}
                >
                  Loaded for
                </span>
              </div>
              <span
                className="font-bold text-base"
                style={{ color: 'var(--text-accent)', letterSpacing: '-0.02em' }}
              >
                {loadedUsername}
              </span>
            </div>

            {/* Stats grid */}
            <div className="flex gap-3">
              <StatPill label="Total"  value={summary.total}   color="var(--text-accent)"    delay="0.05s" />
              <StatPill label="Wins"   value={summary.wins}    color="var(--brand-green)"     delay="0.10s" />
              <StatPill label="Losses" value={summary.losses}  color="var(--move-blunder)"    delay="0.15s" />
              <StatPill label="Draws"  value={summary.draws}   color="var(--move-inaccuracy)" delay="0.20s" />
            </div>

            {/* Date range */}
            <div
              className="flex items-center justify-center gap-2 text-xs py-2 rounded-lg"
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                color: 'var(--text-secondary)',
                opacity: 0.7,
              }}
            >
              <span>{summary.earliest}</span>
              <span style={{ color: 'var(--gold)', opacity: 0.7 }}>→</span>
              <span>{summary.latest}</span>
            </div>

            {/* CTA buttons */}
            <div className="flex gap-3 mt-auto">
              <Link
                to="/analyzer"
                className="btn-primary flex-1 text-center py-2.5 text-sm"
                style={{ borderRadius: 9, fontWeight: 700 }}
              >
                Analyze a Game
              </Link>
              <Link
                to="/heatmap"
                className="btn-secondary flex-1 text-center py-2.5 text-sm"
                style={{ borderRadius: 9, fontWeight: 600 }}
              >
                View Heatmap
              </Link>
            </div>
          </div>
        ) : (
          <RightPanelEmpty />
        )}
      </div>
    </main>
  );
}
