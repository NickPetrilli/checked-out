import { useState, useMemo } from 'react';
import { Chess } from 'chess.js';
import HeatmapGrid from '../components/HeatmapGrid';
import { useChessGamesContext } from '../context/ChessGamesContext';
import type { HeatmapData, Square } from '../types/chess';

// ── Filter types ──────────────────────────────────────────────────────────────

type PieceFilter  = 'all' | 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
type ColorFilter  = 'both' | 'w' | 'b';
type MoveType     = 'to' | 'from';
type ResultFilter = 'all' | 'wins' | 'losses';

// ── Move event record ─────────────────────────────────────────────────────────

interface MoveEvent {
  from: Square;
  to: Square;
  piece: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
  userResult: 'win' | 'loss' | 'draw';
}

// ── Filter pill component ─────────────────────────────────────────────────────

function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-700">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            'px-3 py-1.5 text-xs font-medium transition-colors',
            i > 0 && 'border-l border-gray-700',
            value === opt.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {opt.label}
        </button>
      ))}
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

  // ── Step 1: parse all games once ───────────────────────────────────────────
  // Re-runs only when the games list or username changes.
  const allMoveEvents = useMemo<MoveEvent[]>(() => {
    const events: MoveEvent[] = [];
    for (const game of games) {
      const chess = new Chess();
      try {
        chess.loadPgn(game.pgn);
      } catch {
        continue;
      }

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

  // ── Step 2: filter ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return allMoveEvents.filter((ev) => {
      if (pieceFilter !== 'all' && ev.piece !== pieceFilter) return false;
      if (colorFilter !== 'both' && ev.color !== colorFilter) return false;
      if (resultFilter === 'wins'   && ev.userResult !== 'win')  return false;
      if (resultFilter === 'losses' && ev.userResult !== 'loss') return false;
      return true;
    });
  }, [allMoveEvents, pieceFilter, colorFilter, resultFilter]);

  // ── Step 3: aggregate into 8×8 matrix ──────────────────────────────────────
  const heatmapData = useMemo<Partial<HeatmapData>>(() => {
    const counts: Partial<HeatmapData> = {};
    for (const ev of filtered) {
      const sq = moveType === 'from' ? ev.from : ev.to;
      counts[sq] = (counts[sq] ?? 0) + 1;
    }
    return counts;
  }, [filtered, moveType]);

  const totalMoves = filtered.length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-6 p-6 min-h-[calc(100vh-57px)]">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white">Move Heatmap</h2>
        <p className="text-gray-400 text-sm mt-1">
          Visualise square activity across {games.length} loaded game{games.length !== 1 ? 's' : ''}.
        </p>
      </div>

      {/* States */}
      {loading && <p className="text-gray-400 text-sm">Loading games…</p>}
      {error   && <p className="text-red-400 text-sm">{error}</p>}
      {!loading && !error && games.length === 0 && (
        <p className="text-gray-500 text-sm">Fetch games on the Home page first.</p>
      )}

      {games.length > 0 && (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 justify-center">
            <div className="flex flex-col items-start gap-1">
              <span className="text-xs text-gray-500 font-medium px-1">Piece</span>
              <PillGroup options={PIECE_OPTIONS} value={pieceFilter} onChange={setPieceFilter} />
            </div>
            <div className="flex flex-col items-start gap-1">
              <span className="text-xs text-gray-500 font-medium px-1">Color</span>
              <PillGroup options={COLOR_OPTIONS} value={colorFilter} onChange={setColorFilter} />
            </div>
            <div className="flex flex-col items-start gap-1">
              <span className="text-xs text-gray-500 font-medium px-1">Square type</span>
              <PillGroup options={MOVETYPE_OPTIONS} value={moveType} onChange={setMoveType} />
            </div>
            <div className="flex flex-col items-start gap-1">
              <span className="text-xs text-gray-500 font-medium px-1">Result</span>
              <PillGroup options={RESULT_OPTIONS} value={resultFilter} onChange={setResultFilter} />
            </div>
          </div>

          {/* Move count */}
          <p className="text-gray-500 text-xs">
            {totalMoves.toLocaleString()} move{totalMoves !== 1 ? 's' : ''} matching current filters
          </p>

          {/* Grid */}
          <HeatmapGrid data={heatmapData} />
        </>
      )}
    </div>
  );
}
