import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Chess } from 'chess.js';
import HeatmapGrid from '../components/HeatmapGrid';
import { useChessGamesContext } from '../context/ChessGamesContext';
import useDebounce from '../hooks/useDebounce';
import type { HeatmapData, Square } from '../types/chess';

// ── Filter types ──────────────────────────────────────────────────────────────

type PieceFilter  = 'all' | 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
type ColorFilter  = 'both' | 'w' | 'b';
type MoveType     = 'to' | 'from';
type ResultFilter = 'all' | 'wins' | 'losses';

// ── Move event record ─────────────────────────────────────────────────────────

interface MoveEvent {
  from: Square;
  to:   Square;
  piece: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
  userResult: 'win' | 'loss' | 'draw';
}

// ── Filter pill component ─────────────────────────────────────────────────────

function PillGroup<T extends string>({
  options,
  value,
  onChange,
  groupLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  groupLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="flex rounded-lg overflow-hidden"
      style={{
        border: '1px solid rgba(255,255,255,0.07)',
        backgroundColor: 'rgba(255,255,255,0.02)',
        padding: 2,
        gap: 2,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            aria-label={`${groupLabel}: ${opt.label}`}
            className="px-3 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer rounded-md"
            style={{
              backgroundColor: active
                ? 'var(--brand-green)'
                : 'transparent',
              color: active ? '#fff' : 'var(--text-secondary)',
              boxShadow: active ? '0 1px 8px rgba(82,176,68,0.4)' : 'none',
            }}
            onMouseEnter={e => {
              if (!active) {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PIECE_OPTIONS: { value: PieceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'p',   label: '♟ Pawn' },
  { value: 'n',   label: '♞ Knight' },
  { value: 'b',   label: '♝ Bishop' },
  { value: 'r',   label: '♜ Rook' },
  { value: 'q',   label: '♛ Queen' },
  { value: 'k',   label: '♚ King' },
];

const COLOR_OPTIONS: { value: ColorFilter; label: string }[] = [
  { value: 'both', label: 'Both' },
  { value: 'w',    label: 'White' },
  { value: 'b',    label: 'Black' },
];

const MOVETYPE_OPTIONS: { value: MoveType; label: string }[] = [
  { value: 'to',   label: 'Destinations' },
  { value: 'from', label: 'Origins' },
];

const RESULT_OPTIONS: { value: ResultFilter; label: string }[] = [
  { value: 'all',    label: 'All Games' },
  { value: 'wins',   label: 'Wins' },
  { value: 'losses', label: 'Losses' },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function Heatmap() {
  const { games, loading, error, username } = useChessGamesContext();

  const [pieceFilter,  setPieceFilter]  = useState<PieceFilter>('all');
  const [colorFilter,  setColorFilter]  = useState<ColorFilter>('both');
  const [moveType,     setMoveType]     = useState<MoveType>('to');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');

  const debouncedFilters = useDebounce(
    { pieceFilter, colorFilter, moveType, resultFilter },
    150,
  );

  const allMoveEvents = useMemo<MoveEvent[]>(() => {
    const events: MoveEvent[] = [];
    for (const game of games) {
      const chess = new Chess();
      try { chess.loadPgn(game.pgn); } catch { continue; }

      const userPlayingWhite = game.white.toLowerCase() === username.toLowerCase();
      let userResult: 'win' | 'loss' | 'draw';
      if (game.result === 'draw') {
        userResult = 'draw';
      } else if ((game.result === 'white') === userPlayingWhite) {
        userResult = 'win';
      } else {
        userResult = 'loss';
      }

      for (const move of chess.history({ verbose: true })) {
        events.push({
          from: move.from as Square,
          to:   move.to   as Square,
          piece: move.piece as MoveEvent['piece'],
          color: move.color,
          userResult,
        });
      }
    }
    return events;
  }, [games, username]);

  const filtered = useMemo(() => {
    const { pieceFilter: pf, colorFilter: cf, resultFilter: rf } = debouncedFilters;
    return allMoveEvents.filter((ev) => {
      if (pf !== 'all'   && ev.piece !== pf)            return false;
      if (cf !== 'both'  && ev.color !== cf)            return false;
      if (rf === 'wins'   && ev.userResult !== 'win')   return false;
      if (rf === 'losses' && ev.userResult !== 'loss')  return false;
      return true;
    });
  }, [allMoveEvents, debouncedFilters]);

  const heatmapData = useMemo<Partial<HeatmapData>>(() => {
    const counts: Partial<HeatmapData> = {};
    for (const ev of filtered) {
      const sq = debouncedFilters.moveType === 'from' ? ev.from : ev.to;
      counts[sq] = (counts[sq] ?? 0) + 1;
    }
    return counts;
  }, [filtered, debouncedFilters.moveType]);

  const totalMoves = filtered.length;

  return (
    <div
      className="wood-grain flex flex-col items-center gap-7 px-6 py-10 min-h-[calc(100vh-60px)]"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Header */}
      <div className="text-center flex flex-col gap-2">
        <h2
          className="font-extrabold tracking-tight"
          style={{ fontSize: 28, color: 'var(--text-accent)', letterSpacing: '-0.03em' }}
        >
          Move Heatmap
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Visualise square activity across{' '}
          <span style={{ color: 'var(--brand-green)', fontWeight: 600 }}>{games.length}</span>{' '}
          loaded game{games.length !== 1 ? 's' : ''}.
        </p>
      </div>

      {loading && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading games…</p>}
      {error   && <p className="text-sm" style={{ color: 'var(--move-blunder)' }}>{error}</p>}

      {!loading && !error && games.length === 0 && (
        <div className="flex flex-col items-center gap-5 mt-12 text-center" role="status">
          <div
            className="flex items-center justify-center w-16 h-16 rounded-2xl text-4xl"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
            aria-hidden="true"
          >
            ♟
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="font-bold text-lg" style={{ color: 'var(--text-accent)', letterSpacing: '-0.02em' }}>
              No games loaded
            </p>
            <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>
              Fetch games for a player first to explore their move heatmap.
            </p>
          </div>
          <Link to="/" className="btn-primary mt-1 text-sm">
            Go to Home
          </Link>
        </div>
      )}

      {games.length > 0 && (
        <>
          {/* Filter bar */}
          <div
            className="flex flex-wrap gap-4 justify-center p-4 rounded-2xl"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {[
              { label: 'Piece',       el: <PillGroup options={PIECE_OPTIONS}    value={pieceFilter}  onChange={setPieceFilter}  groupLabel="Piece" /> },
              { label: 'Color',       el: <PillGroup options={COLOR_OPTIONS}    value={colorFilter}  onChange={setColorFilter}  groupLabel="Color" /> },
              { label: 'Square type', el: <PillGroup options={MOVETYPE_OPTIONS} value={moveType}     onChange={setMoveType}     groupLabel="Square type" /> },
              { label: 'Result',      el: <PillGroup options={RESULT_OPTIONS}   value={resultFilter} onChange={setResultFilter} groupLabel="Result" /> },
            ].map(({ label, el }) => (
              <div key={label} className="flex flex-col items-start gap-1.5">
                <span
                  className="text-xs font-semibold uppercase tracking-widest px-1"
                  style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em', opacity: 0.7 }}
                >
                  {label}
                </span>
                {el}
              </div>
            ))}
          </div>

          {/* Move count */}
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)', opacity: 0.55 }}>
            <span style={{ color: 'var(--gold)', opacity: 0.9, fontWeight: 600 }}>
              {totalMoves.toLocaleString()}
            </span>
            {' '}move{totalMoves !== 1 ? 's' : ''} matching current filters
          </p>

          <HeatmapGrid data={heatmapData} />
        </>
      )}
    </div>
  );
}
