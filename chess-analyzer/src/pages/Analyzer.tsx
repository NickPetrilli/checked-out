import { useState, useRef, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/ChessBoard';
import GameList from '../components/GameList';
import { useChessGamesContext } from '../context/ChessGamesContext';
import { evaluatePosition } from '../services/stockfish';
import type { ParsedGame } from '../types/chess';

// ── Types ────────────────────────────────────────────────────────────────────

interface Ply {
  san: string;
  color: 'w' | 'b';
  moveNumber: number; // chess full-move number (1-based)
  fenBefore: string;
  fenAfter: string;
}

interface PlyEval {
  normalizedScore: number; // centipawns, white's perspective
  bestMove: string;
}

type Classification = 'blunder' | 'mistake';

// ── Constants ────────────────────────────────────────────────────────────────

const DEPTH = 15;
const BLUNDER_THRESHOLD = 300;
const MISTAKE_THRESHOLD = 100;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatScore(score: number): string {
  if (score >= 9_900) return `M${10_000 - score}`;
  if (score <= -9_900) return `-M${10_000 + score}`;
  const s = (score / 100).toFixed(2);
  return score > 0 ? `+${s}` : s;
}

function evalBarWhitePct(score: number): number {
  return Math.min(100, Math.max(0, 50 + score / 20));
}

function classifyPly(
  evals: (PlyEval | null)[],
  plyIdx: number,
  color: 'w' | 'b',
): { classification?: Classification; scoreDrop: number } {
  const before = evals[plyIdx];
  const after = evals[plyIdx + 1];
  if (!before || !after) return { scoreDrop: 0 };

  const drop =
    color === 'w'
      ? before.normalizedScore - after.normalizedScore
      : after.normalizedScore - before.normalizedScore;

  if (drop >= BLUNDER_THRESHOLD) return { classification: 'blunder', scoreDrop: drop };
  if (drop >= MISTAKE_THRESHOLD) return { classification: 'mistake', scoreDrop: drop };
  return { scoreDrop: Math.max(0, drop) };
}

function parsePlies(pgn: string): { plies: Ply[]; fens: string[] } {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const history = chess.history({ verbose: true });

  chess.reset();
  // reset to the starting FEN from the PGN (may differ from default if SetUp/FEN headers present)
  try { chess.loadPgn(pgn); } catch { /* noop */ }
  chess.reset();
  try {
    const tmp = new Chess();
    tmp.loadPgn(pgn);
    const setupFen = tmp.header()['FEN'];
    if (setupFen) chess.load(setupFen);
  } catch { /* noop */ }

  const fens: string[] = [chess.fen()];
  const plies: Ply[] = [];

  for (const move of history) {
    const fenBefore = chess.fen();
    chess.move(move);
    const fenAfter = chess.fen();
    plies.push({
      san: move.san,
      color: move.color,
      moveNumber: move.color === 'w'
        ? Math.ceil(plies.length / 2) + 1
        : Math.ceil((plies.length + 1) / 2),
      fenBefore,
      fenAfter,
    });
    fens.push(fenAfter);
  }

  return { plies, fens };
}

// ── Sub-components ───────────────────────────────────────────────────────────

function EvalBar({ score }: { score: number | undefined }) {
  const pct = evalBarWhitePct(score ?? 0);
  return (
    <div className="w-full h-3 rounded-full overflow-hidden bg-gray-700 flex">
      <div
        className="h-full bg-gray-100 transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
      <div className="h-full flex-1 bg-gray-800" />
    </div>
  );
}

function ClassBadge({ c }: { c?: Classification }) {
  if (!c) return null;
  return c === 'blunder' ? (
    <span className="text-red-400 font-bold ml-0.5" title="Blunder">??</span>
  ) : (
    <span className="text-orange-400 font-bold ml-0.5" title="Mistake">?</span>
  );
}

interface MoveTableProps {
  plies: Ply[];
  evals: (PlyEval | null)[];
  currentPly: number; // 0 = start position
  onJump: (plyIndex: number) => void;
}

function MoveTable({ plies, evals, currentPly, onJump }: MoveTableProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [currentPly]);

  const pairs: [Ply, number, Ply | undefined, number][] = [];
  for (let i = 0; i < plies.length; i += 2) {
    pairs.push([plies[i], i, plies[i + 1], i + 1]);
  }

  return (
    <div className="overflow-y-auto flex-1 min-h-0 text-sm">
      {pairs.map(([white, wi, black, bi]) => {
        const wClass = classifyPly(evals, wi, 'w');
        const bClass = black ? classifyPly(evals, bi, 'b') : undefined;
        const wActive = currentPly === wi + 1;
        const bActive = currentPly === bi + 1;

        return (
          <div key={wi} className="flex items-center gap-1 px-2 py-0.5 hover:bg-gray-800/50">
            <span className="w-8 text-gray-500 text-xs shrink-0">{white.moveNumber}.</span>

            {/* White ply */}
            <button
              ref={wActive ? activeRef : undefined}
              onClick={() => onJump(wi + 1)}
              className={[
                'flex items-center gap-1 px-2 py-0.5 rounded flex-1 text-left transition-colors',
                wActive ? 'bg-blue-600 text-white' : 'text-gray-200 hover:bg-gray-700',
              ].join(' ')}
            >
              <span className="font-medium">{white.san}</span>
              <ClassBadge c={wClass.classification} />
              {evals[wi + 1] && (
                <span className="ml-auto text-xs text-gray-400 tabular-nums">
                  {formatScore(evals[wi + 1]!.normalizedScore)}
                </span>
              )}
            </button>

            {/* Black ply */}
            {black ? (
              <button
                ref={bActive ? activeRef : undefined}
                onClick={() => onJump(bi + 1)}
                className={[
                  'flex items-center gap-1 px-2 py-0.5 rounded flex-1 text-left transition-colors',
                  bActive ? 'bg-blue-600 text-white' : 'text-gray-200 hover:bg-gray-700',
                ].join(' ')}
              >
                <span className="font-medium">{black.san}</span>
                <ClassBadge c={bClass?.classification} />
                {evals[bi + 1] && (
                  <span className="ml-auto text-xs text-gray-400 tabular-nums">
                    {formatScore(evals[bi + 1]!.normalizedScore)}
                  </span>
                )}
              </button>
            ) : (
              <div className="flex-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface SummaryPanelProps {
  plies: Ply[];
  evals: (PlyEval | null)[];
  onJump: (plyIndex: number) => void;
}

function SummaryPanel({ plies, evals, onJump }: SummaryPanelProps) {
  let wBlunders = 0, wMistakes = 0, bBlunders = 0, bMistakes = 0;
  let worstIdx = -1, worstDrop = 0;

  for (let i = 0; i < plies.length; i++) {
    const { classification, scoreDrop } = classifyPly(evals, i, plies[i].color);
    if (!classification) continue;
    if (plies[i].color === 'w') {
      if (classification === 'blunder') wBlunders++;
      else wMistakes++;
    } else {
      if (classification === 'blunder') bBlunders++;
      else bMistakes++;
    }
    if (scoreDrop > worstDrop) { worstDrop = scoreDrop; worstIdx = i; }
  }

  const worstPly = worstIdx >= 0 ? plies[worstIdx] : null;

  return (
    <div className="border-t border-gray-700 pt-3 mt-2 text-xs text-gray-400 flex flex-col gap-2">
      <p className="text-gray-300 font-semibold text-sm">Analysis Summary</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-gray-400">White blunders</span>
        <span className="text-red-400 font-bold">{wBlunders}</span>
        <span className="text-gray-400">White mistakes</span>
        <span className="text-orange-400 font-bold">{wMistakes}</span>
        <span className="text-gray-400">Black blunders</span>
        <span className="text-red-400 font-bold">{bBlunders}</span>
        <span className="text-gray-400">Black mistakes</span>
        <span className="text-orange-400 font-bold">{bMistakes}</span>
      </div>
      {worstPly && (
        <div className="bg-red-900/30 border border-red-800/50 rounded p-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-red-300 font-semibold">Worst blunder</p>
            <p className="text-gray-400">
              Move {worstPly.moveNumber}{worstPly.color === 'b' ? '…' : '.'}{' '}
              <span className="text-white font-mono">{worstPly.san}</span>
              {' '}<span className="text-red-400">??</span>
              {' '}(−{(worstDrop / 100).toFixed(2)})
            </p>
          </div>
          <button
            onClick={() => onJump(worstIdx + 1)}
            className="px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded text-xs whitespace-nowrap transition-colors"
          >
            Jump
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Analyzer() {
  const { games, selectedGame, selectGame } = useChessGamesContext();

  const [plies, setPlies] = useState<Ply[]>([]);
  const [fens, setFens] = useState<string[]>([]);
  const [evals, setEvals] = useState<(PlyEval | null)[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(0);
  const [analysisTotal, setAnalysisTotal] = useState(0);

  const cancelRef = useRef(0);

  // ── Game selection ──────────────────────────────────────────────────────────

  const handleSelectGame = useCallback(
    async (game: ParsedGame) => {
      selectGame(game);

      const token = ++cancelRef.current;
      const { plies: newPlies, fens: newFens } = parsePlies(game.pgn);

      setPlies(newPlies);
      setFens(newFens);
      setEvals(new Array(newFens.length).fill(null));
      setCurrentPly(0);
      setIsAnalyzing(true);
      setAnalysisDone(0);
      setAnalysisTotal(newFens.length);

      const evalsAcc: (PlyEval | null)[] = new Array(newFens.length).fill(null);

      for (let i = 0; i < newFens.length; i++) {
        if (cancelRef.current !== token) return;

        try {
          const result = await evaluatePosition(newFens[i], DEPTH);
          if (cancelRef.current !== token) return;
          evalsAcc[i] = { normalizedScore: result.score, bestMove: result.bestMove };
          setEvals([...evalsAcc]);
          setAnalysisDone(i + 1);
        } catch (err) {
          console.error(`Eval failed at position ${i}:`, err);
        }
      }

      if (cancelRef.current === token) setIsAnalyzing(false);
    },
    [selectGame],
  );

  // ── Navigation ──────────────────────────────────────────────────────────────

  const goTo = useCallback(
    (idx: number) => setCurrentPly(Math.max(0, Math.min(idx, fens.length - 1))),
    [fens.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goTo(currentPly - 1);
      if (e.key === 'ArrowRight') goTo(currentPly + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentPly, goTo]);

  // ── Board ────────────────────────────────────────────────────────────────────

  const currentFen = fens[currentPly] ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const currentEval = evals[currentPly];
  const analysisComplete = !isAnalyzing && plies.length > 0;

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden">
      {/* ── Left: game list ───────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-gray-800 flex flex-col p-3 overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-300 mb-2 shrink-0">Games</h2>
        {games.length === 0 && (
          <p className="text-gray-500 text-xs">Fetch games on the Home page first.</p>
        )}
        <GameList
          games={games}
          selectedGame={selectedGame}
          onSelectGame={handleSelectGame}
        />
      </aside>

      {/* ── Center: board + controls ──────────────────────────────────────── */}
      <main className="flex flex-col items-center justify-start gap-3 p-4 overflow-y-auto flex-1 min-w-0">
        {/* Eval bar */}
        <div className="w-full max-w-sm">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Black</span>
            {currentEval && (
              <span className={currentEval.normalizedScore >= 0 ? 'text-white' : 'text-gray-300'}>
                {formatScore(currentEval.normalizedScore)}
              </span>
            )}
            <span>White</span>
          </div>
          <EvalBar score={currentEval?.normalizedScore} />
        </div>

        {/* Board */}
        <div className="w-full max-w-sm">
          <ChessBoard fen={currentFen} />
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          {[
            { label: '|◀', title: 'Start', action: () => goTo(0) },
            { label: '◀', title: 'Previous (←)', action: () => goTo(currentPly - 1) },
            { label: '▶', title: 'Next (→)', action: () => goTo(currentPly + 1) },
            { label: '▶|', title: 'End', action: () => goTo(fens.length - 1) },
          ].map(({ label, title, action }) => (
            <button
              key={label}
              onClick={action}
              title={title}
              disabled={plies.length === 0}
              className="w-9 h-9 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 transition-colors text-sm font-mono"
            >
              {label}
            </button>
          ))}
          {plies.length > 0 && (
            <span className="text-xs text-gray-500 ml-1">
              {currentPly}/{plies.length}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {isAnalyzing && (
          <div className="w-full max-w-sm">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Analyzing…</span>
              <span>{analysisDone}/{analysisTotal}</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-200"
                style={{ width: `${(analysisDone / analysisTotal) * 100}%` }}
              />
            </div>
          </div>
        )}

        {!selectedGame && (
          <p className="text-gray-600 text-sm mt-4">Select a game from the list to begin.</p>
        )}
      </main>

      {/* ── Right: move list + summary ────────────────────────────────────── */}
      {plies.length > 0 && (
        <aside className="w-64 shrink-0 border-l border-gray-800 flex flex-col p-3 overflow-hidden">
          <h2 className="text-sm font-semibold text-gray-300 mb-2 shrink-0">Moves</h2>
          <MoveTable
            plies={plies}
            evals={evals}
            currentPly={currentPly}
            onJump={goTo}
          />
          {analysisComplete && (
            <SummaryPanel plies={plies} evals={evals} onJump={goTo} />
          )}
        </aside>
      )}
    </div>
  );
}
