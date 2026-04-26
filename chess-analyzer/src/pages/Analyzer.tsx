import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Link } from 'react-router-dom';
import ChessBoard from '../components/ChessBoard';
import GameList from '../components/GameList';
import { useChessGamesContext } from '../context/ChessGamesContext';
import { evaluatePosition, ensureEngineReady } from '../services/stockfish';
import type { ParsedGame } from '../types/chess';

// ── Types ────────────────────────────────────────────────────────────────────

interface Ply {
  san: string;
  color: 'w' | 'b';
  moveNumber: number;
  fenBefore: string;
  fenAfter: string;
}

interface PlyEval {
  normalizedScore: number;
  bestMove: string;
}

type Classification = 'blunder' | 'mistake';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEPTH             = 15;
const BLUNDER_THRESHOLD = 300;
const MISTAKE_THRESHOLD = 100;
const RIGHT_MIN_WIDTH   = 200;
const RIGHT_MAX_WIDTH   = 560;
const RIGHT_DEFAULT     = 300;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatScore(score: number): string {
  if (score >= 9_900)  return `M${10_000 - score}`;
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
  const after  = evals[plyIdx + 1];
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
  const tmp = new Chess();
  tmp.loadPgn(pgn);
  const history  = tmp.history({ verbose: true });
  const setupFen = tmp.header()['FEN'];

  const chess = new Chess();
  if (setupFen) chess.load(setupFen);

  const fens: string[] = [chess.fen()];
  const plies: Ply[]   = [];

  for (const move of history) {
    const fenBefore = chess.fen();
    chess.move(move);
    plies.push({
      san: move.san,
      color: move.color,
      moveNumber:
        move.color === 'w'
          ? Math.ceil(plies.length / 2) + 1
          : Math.ceil((plies.length + 1) / 2),
      fenBefore,
      fenAfter: chess.fen(),
    });
    fens.push(chess.fen());
  }
  return { plies, fens };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EvalBar({ score }: { score: number | undefined }) {
  const pct   = evalBarWhitePct(score ?? 0);
  const label = score !== undefined ? formatScore(score) : '—';
  return (
    <div
      role="meter"
      aria-label={`Position evaluation: ${label}`}
      aria-valuenow={score ?? 0}
      aria-valuemin={-1000}
      aria-valuemax={1000}
      className="w-full h-3 rounded-full overflow-hidden bg-gray-700 flex"
    >
      <div className="h-full bg-gray-100 transition-all duration-300" style={{ width: `${pct}%` }} />
      <div className="h-full flex-1 bg-gray-800" />
    </div>
  );
}

function ClassBadge({ c }: { c?: Classification }) {
  if (!c) return null;
  return c === 'blunder' ? (
    <span
      aria-label="Blunder"
      title="Blunder (−3 pawns or more)"
      className="inline-flex items-center gap-0.5 shrink-0"
    >
      <span className="text-red-400 font-bold text-xs" aria-hidden="true">??</span>
      <span className="text-red-400 font-bold text-xs uppercase tracking-wide" aria-hidden="true">Blunder</span>
    </span>
  ) : (
    <span
      aria-label="Mistake"
      title="Mistake (−1 to −3 pawns)"
      className="inline-flex items-center gap-0.5 shrink-0"
    >
      <span className="text-orange-400 font-bold text-xs" aria-hidden="true">?</span>
      <span className="text-orange-400 font-bold text-xs uppercase tracking-wide" aria-hidden="true">Mistake</span>
    </span>
  );
}

// ── Player nameplate ─────────────────────────────────────────────────────────

interface NameplateProps {
  name:    string;
  rating:  number;
  color:   'white' | 'black';
  isUser:  boolean;
}

function PlayerNameplate({ name, rating, color, isUser }: NameplateProps) {
  return (
    <div className="flex items-center gap-2 w-full">
      <span
        aria-hidden="true"
        className={[
          'w-4 h-4 rounded-sm shrink-0 border',
          color === 'white' ? 'bg-gray-100 border-gray-400' : 'bg-gray-800 border-gray-600',
        ].join(' ')}
      />
      <span className={['font-semibold text-sm truncate', isUser ? 'text-white' : 'text-gray-300'].join(' ')}>
        {name}
      </span>
      <span className="text-gray-500 text-xs tabular-nums shrink-0">({rating})</span>
      {isUser && (
        <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-bold bg-blue-600 text-white shrink-0">
          You
        </span>
      )}
    </div>
  );
}

// ── Move table ────────────────────────────────────────────────────────────────

interface MoveTableProps {
  plies:        Ply[];
  evals:        (PlyEval | null)[];
  currentPly:   number;
  onJump:       (idx: number) => void;
  whiteName?:   string;
  blackName?:   string;
  username?:    string;
}

function MoveTable({ plies, evals, currentPly, onJump, whiteName, blackName, username }: MoveTableProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [currentPly]);

  const pairs: [Ply, number, Ply | undefined, number][] = [];
  for (let i = 0; i < plies.length; i += 2) {
    pairs.push([plies[i], i, plies[i + 1], i + 1]);
  }

  const userIsWhite = username && whiteName && username.toLowerCase() === whiteName.toLowerCase();
  const userIsBlack = username && blackName && username.toLowerCase() === blackName.toLowerCase();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Column headers */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-700 shrink-0 bg-gray-900">
        <span className="w-7 shrink-0" aria-hidden="true" />
        {/* White column header */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-100 border border-gray-500 shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-gray-300 truncate">
            {whiteName ?? 'White'}
          </span>
          {userIsWhite && (
            <span className="text-xs font-bold text-blue-400 shrink-0">You</span>
          )}
        </div>
        {/* Black column header */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-800 border border-gray-500 shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-gray-300 truncate">
            {blackName ?? 'Black'}
          </span>
          {userIsBlack && (
            <span className="text-xs font-bold text-blue-400 shrink-0">You</span>
          )}
        </div>
      </div>

      <ol aria-label="Move list" className="overflow-y-auto flex-1 min-h-0 text-sm list-none m-0 p-0">
      {pairs.map(([white, wi, black, bi]) => {
        const wClass  = classifyPly(evals, wi, 'w');
        const bClass  = black ? classifyPly(evals, bi, 'b') : undefined;
        const wActive = currentPly === wi + 1;
        const bActive = currentPly === bi + 1;
        const wScore  = evals[wi + 1];
        const bScore  = black ? evals[bi + 1] : null;

        return (
          <li key={wi} className="flex items-center gap-1 px-2 py-0.5 hover:bg-gray-800/50">
            {/* Move number */}
            <span className="w-7 text-gray-500 text-xs shrink-0 tabular-nums" aria-hidden="true">
              {white.moveNumber}.
            </span>

            {/* White: button + score in separate column */}
            <div className="flex items-center flex-1 min-w-0 gap-1">
              <button
                ref={wActive ? activeRef : undefined}
                onClick={() => onJump(wi + 1)}
                aria-label={`Move ${white.moveNumber} white: ${white.san}${wClass.classification ? `, ${wClass.classification}` : ''}`}
                aria-current={wActive ? 'true' : undefined}
                className={[
                  'flex items-center gap-1 px-1.5 py-0.5 rounded text-left transition-colors flex-1 min-w-0',
                  wActive ? 'bg-blue-600 text-white' : 'text-gray-200 hover:bg-gray-700',
                ].join(' ')}
              >
                <span className="font-medium truncate">{white.san}</span>
                <ClassBadge c={wClass.classification} />
              </button>
              <span className="text-xs text-gray-500 tabular-nums w-14 text-right shrink-0">
                {wScore ? formatScore(wScore.normalizedScore) : ''}
              </span>
            </div>

            {/* Black: button + score in separate column */}
            {black ? (
              <div className="flex items-center flex-1 min-w-0 gap-1">
                <button
                  ref={bActive ? activeRef : undefined}
                  onClick={() => onJump(bi + 1)}
                  aria-label={`Move ${black.moveNumber} black: ${black.san}${bClass?.classification ? `, ${bClass.classification}` : ''}`}
                  aria-current={bActive ? 'true' : undefined}
                  className={[
                    'flex items-center gap-1 px-1.5 py-0.5 rounded text-left transition-colors flex-1 min-w-0',
                    bActive ? 'bg-blue-600 text-white' : 'text-gray-200 hover:bg-gray-700',
                  ].join(' ')}
                >
                  <span className="font-medium truncate">{black.san}</span>
                  <ClassBadge c={bClass?.classification} />
                </button>
                <span className="text-xs text-gray-500 tabular-nums w-14 text-right shrink-0">
                  {bScore ? formatScore(bScore.normalizedScore) : ''}
                </span>
              </div>
            ) : (
              <div className="flex-1" />
            )}
          </li>
        );
      })}
      </ol>
    </div>
  );
}

// ── Summary panel ─────────────────────────────────────────────────────────────

interface SummaryPanelProps {
  plies:  Ply[];
  evals:  (PlyEval | null)[];
  onJump: (idx: number) => void;
}

function SummaryPanel({ plies, evals, onJump }: SummaryPanelProps) {
  const summary = useMemo(() => {
    let wBlunders = 0, wMistakes = 0, bBlunders = 0, bMistakes = 0;
    let worstIdx  = -1, worstDrop = 0;

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
    return { wBlunders, wMistakes, bBlunders, bMistakes, worstIdx, worstDrop };
  }, [plies, evals]);

  const { wBlunders, wMistakes, bBlunders, bMistakes, worstIdx, worstDrop } = summary;
  const worstPly = worstIdx >= 0 ? plies[worstIdx] : null;

  return (
    <section aria-label="Analysis summary" className="border-t border-gray-700 pt-3 mt-2 text-xs text-gray-400 flex flex-col gap-2 shrink-0">
      <p className="text-gray-300 font-semibold text-sm">Analysis Summary</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <dt>White blunders ??</dt>
        <dd className="text-red-400 font-bold">{wBlunders}</dd>
        <dt>White mistakes ?</dt>
        <dd className="text-orange-400 font-bold">{wMistakes}</dd>
        <dt>Black blunders ??</dt>
        <dd className="text-red-400 font-bold">{bBlunders}</dd>
        <dt>Black mistakes ?</dt>
        <dd className="text-orange-400 font-bold">{bMistakes}</dd>
      </dl>
      {worstPly && (
        <div className="bg-red-900/30 border border-red-800/50 rounded p-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-red-300 font-semibold">Worst blunder ??</p>
            <p className="text-gray-400">
              Move {worstPly.moveNumber}{worstPly.color === 'b' ? '…' : '.'}{' '}
              <span className="text-white font-mono">{worstPly.san}</span>
              {' '}(−{(worstDrop / 100).toFixed(2)})
            </p>
          </div>
          <button
            onClick={() => onJump(worstIdx + 1)}
            aria-label={`Jump to worst blunder: move ${worstPly.moveNumber} ${worstPly.san}`}
            className="px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded text-xs whitespace-nowrap transition-colors"
          >
            Jump
          </button>
        </div>
      )}
    </section>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ engineError }: { engineError: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
      <p className="text-4xl" aria-hidden="true">♟</p>
      <p className="text-gray-300 font-semibold text-lg">No games loaded</p>
      <p className="text-gray-500 text-sm max-w-xs">
        Fetch your Chess.com games on the Home page first, then come back here to analyse them.
      </p>
      <Link
        to="/"
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
      >
        Go to Home
      </Link>
      {engineError && (
        <div role="alert" className="mt-2 w-full max-w-sm bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
          <p className="font-semibold mb-1">Chess engine failed to load</p>
          <p>{engineError}</p>
          <p className="mt-1 text-red-400/70 text-xs">Analysis will be unavailable. Try refreshing the page.</p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Analyzer() {
  const { games, selectedGame, selectGame, username } = useChessGamesContext();

  const [plies,         setPlies]         = useState<Ply[]>([]);
  const [fens,          setFens]          = useState<string[]>([]);
  const [evals,         setEvals]         = useState<(PlyEval | null)[]>([]);
  const [currentPly,    setCurrentPly]    = useState(0);
  const [isAnalyzing,   setIsAnalyzing]   = useState(false);
  const [analysisDone,  setAnalysisDone]  = useState(0);
  const [analysisTotal, setAnalysisTotal] = useState(0);
  const [engineError,   setEngineError]   = useState<string | null>(null);
  const [leftOpen,      setLeftOpen]      = useState(true);
  const [rightWidth,    setRightWidth]    = useState(RIGHT_DEFAULT);

  const cancelRef       = useRef(0);
  const isDraggingRef   = useRef(false);
  const dragStartXRef   = useRef(0);
  const dragStartWRef   = useRef(0);

  // Pre-warm engine and surface any init errors
  useEffect(() => {
    ensureEngineReady().catch((err: unknown) => {
      setEngineError(err instanceof Error ? err.message : 'Failed to load chess engine.');
    });
  }, []);

  // ── Right-panel drag-to-resize ──────────────────────────────────────────────

  function startDrag(e: React.MouseEvent) {
    isDraggingRef.current  = true;
    dragStartXRef.current  = e.clientX;
    dragStartWRef.current  = rightWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor     = 'ew-resize';
    e.preventDefault();
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDraggingRef.current) return;
      const delta   = dragStartXRef.current - e.clientX; // drag left = wider
      const newWidth = Math.min(RIGHT_MAX_WIDTH, Math.max(RIGHT_MIN_WIDTH, dragStartWRef.current + delta));
      setRightWidth(newWidth);
    }
    function onMouseUp() {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor     = '';
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // ── Game selection ──────────────────────────────────────────────────────────

  const handleSelectGame = useCallback(
    async (game: ParsedGame) => {
      if (engineError) return;
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

      const acc: (PlyEval | null)[] = new Array(newFens.length).fill(null);

      for (let i = 0; i < newFens.length; i++) {
        if (cancelRef.current !== token) return;
        try {
          const result = await evaluatePosition(newFens[i], DEPTH);
          if (cancelRef.current !== token) return;
          acc[i] = { normalizedScore: result.score, bestMove: result.bestMove };
          setEvals([...acc]);
          setAnalysisDone(i + 1);
        } catch (err) {
          console.error(`Eval failed at position ${i}:`, err);
        }
      }

      if (cancelRef.current === token) setIsAnalyzing(false);
    },
    [selectGame, engineError],
  );

  // ── Keyboard navigation ─────────────────────────────────────────────────────

  const goTo = useCallback(
    (idx: number) => setCurrentPly(Math.max(0, Math.min(idx, fens.length - 1))),
    [fens.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft')  goTo(currentPly - 1);
      if (e.key === 'ArrowRight') goTo(currentPly + 1);
      if (e.key === 'Home')       goTo(0);
      if (e.key === 'End')        goTo(fens.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentPly, goTo, fens.length]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const currentFen      = fens[currentPly] ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const currentEval     = evals[currentPly];
  const analysisComplete = !isAnalyzing && plies.length > 0;

  if (games.length === 0) {
    return <EmptyState engineError={engineError} />;
  }

  return (
    <div className="flex h-[calc(100vh-52px)] overflow-hidden">

      {/* ── Left: game list (collapsible) ───────────────────────────────── */}
      {leftOpen ? (
        <aside
          aria-label="Game list"
          className="w-72 shrink-0 border-r border-gray-800 flex flex-col p-3 overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h2 className="text-sm font-semibold text-gray-300">Games</h2>
            <button
              onClick={() => setLeftOpen(false)}
              aria-label="Collapse game list"
              title="Collapse game list"
              className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
            >
              ◀
            </button>
          </div>
          {engineError && (
            <div role="alert" className="mb-2 text-xs text-red-400 bg-red-900/30 border border-red-800/50 rounded p-2">
              Engine unavailable — analysis disabled.
            </div>
          )}
          <GameList
            games={games}
            selectedGame={selectedGame}
            onSelectGame={handleSelectGame}
          />
        </aside>
      ) : (
        <div className="shrink-0 border-r border-gray-800 flex flex-col items-center pt-2 bg-gray-900 w-8">
          <button
            onClick={() => setLeftOpen(true)}
            aria-label="Expand game list"
            title="Expand game list"
            className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors text-xs"
          >
            ▶
          </button>
        </div>
      )}

      {/* ── Center: board ───────────────────────────────────────────────── */}
      <main
        aria-label="Chess board and controls"
        className="flex flex-col items-center justify-start gap-3 p-4 overflow-y-auto flex-1 min-w-0"
      >
        {/* Eval bar + score — same width as board */}
        <div style={{ width: 'min(100%, calc(100vh - 240px))' }}>
          <div className="flex justify-between text-xs text-gray-500 mb-1" aria-hidden="true">
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

        {/* Black nameplate (top of board) */}
        {selectedGame && (
          <div style={{ width: 'min(100%, calc(100vh - 240px))' }}>
            <PlayerNameplate
              name={selectedGame.black}
              rating={selectedGame.blackRating}
              color="black"
              isUser={username.toLowerCase() === selectedGame.black.toLowerCase()}
            />
          </div>
        )}

        {/* Board */}
        <div style={{ width: 'min(100%, calc(100vh - 240px))' }}>
          <ChessBoard fen={currentFen} />
        </div>

        {/* White nameplate (bottom of board) */}
        {selectedGame && (
          <div style={{ width: 'min(100%, calc(100vh - 240px))' }}>
            <PlayerNameplate
              name={selectedGame.white}
              rating={selectedGame.whiteRating}
              color="white"
              isUser={username.toLowerCase() === selectedGame.white.toLowerCase()}
            />
          </div>
        )}

        {/* Navigation */}
        <div role="group" aria-label="Move navigation" className="flex items-center gap-2">
          {[
            { label: '|◀', ariaLabel: 'Go to start',     key: 'start', action: () => goTo(0),              disabled: currentPly === 0 },
            { label: '◀',  ariaLabel: 'Previous move',   key: 'prev',  action: () => goTo(currentPly - 1), disabled: currentPly === 0 },
            { label: '▶',  ariaLabel: 'Next move',       key: 'next',  action: () => goTo(currentPly + 1), disabled: currentPly >= fens.length - 1 },
            { label: '▶|', ariaLabel: 'Go to last move', key: 'end',   action: () => goTo(fens.length - 1), disabled: currentPly >= fens.length - 1 },
          ].map(({ label, ariaLabel, key, action, disabled }) => (
            <button
              key={key}
              onClick={action}
              aria-label={ariaLabel}
              disabled={plies.length === 0 || disabled}
              className="w-9 h-9 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 transition-colors text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <span aria-hidden="true">{label}</span>
            </button>
          ))}
          {plies.length > 0 && (
            <span className="text-xs text-gray-500 ml-1" aria-live="polite">
              {currentPly}/{plies.length}
            </span>
          )}
        </div>

        {/* Analysis progress */}
        {isAnalyzing && (
          <div role="status" aria-live="polite" style={{ width: 'min(100%, calc(100vh - 240px))' }}>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Analyzing move {analysisDone}/{analysisTotal}…</span>
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
          <p className="text-gray-600 text-sm mt-4">Select a game from the list to begin analysis.</p>
        )}
      </main>

      {/* ── Right: move list + summary (resizable) ──────────────────────── */}
      {plies.length > 0 && (
        <>
          {/* Drag handle */}
          <div
            onMouseDown={startDrag}
            aria-hidden="true"
            className="w-1.5 shrink-0 cursor-ew-resize bg-gray-800 hover:bg-blue-600 transition-colors"
            title="Drag to resize"
          />

          <aside
            aria-label="Move analysis panel"
            style={{ width: rightWidth }}
            className="shrink-0 flex flex-col p-3 overflow-hidden border-l border-gray-800"
          >
            <h2 className="text-sm font-semibold text-gray-300 mb-2 shrink-0">Moves</h2>
            <MoveTable
              plies={plies}
              evals={evals}
              currentPly={currentPly}
              onJump={goTo}
              whiteName={selectedGame?.white}
              blackName={selectedGame?.black}
              username={username}
            />
            {analysisComplete && (
              <SummaryPanel plies={plies} evals={evals} onJump={goTo} />
            )}
          </aside>
        </>
      )}
    </div>
  );
}
