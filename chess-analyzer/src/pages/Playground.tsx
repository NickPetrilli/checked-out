import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import { Lightbulb } from 'lucide-react';
import ChessBoard from '../components/ChessBoard';
import { EvalBar, formatEvalLabel } from '../utils/evalBar';
import { evaluateMultiPV, ensureEngineReady, destroyEngine } from '../services/stockfish';
import type { MultiPVResult } from '../services/stockfish';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const RIGHT_WIDTH  = 340;

interface HistoryEntry {
  san:  string;
  from: string;
  to:   string;
  fen:  string; // position AFTER the move
}

// Convert a PV (UCI array) to SAN strings, starting from the given FEN.
function pvToSan(fen: string, pvUCI: string[]): string[] {
  const c = new Chess();
  try { c.load(fen); } catch { return []; }
  const sans: string[] = [];
  for (const uci of pvUCI.slice(0, 8)) {
    try {
      const move = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: (uci[4] ?? 'q') as 'q' });
      if (!move) break;
      sans.push(move.san);
    } catch { break; }
  }
  return sans;
}

export default function Playground() {
  const [history,        setHistory]        = useState<HistoryEntry[]>([]);
  const [cursor,         setCursor]         = useState(0); // 0 = starting position
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves,     setLegalMoves]     = useState<Move[]>([]);
  const [flipped,        setFlipped]        = useState(false);
  const [multiPV,        setMultiPV]        = useState<MultiPVResult | null>(null);
  const [multiPVLoading, setMultiPVLoading] = useState(true);
  const [arrowUCI,       setArrowUCI]       = useState<string | null>(null);

  const activeMoveRef = useRef<HTMLButtonElement>(null);
  const boardAreaMaxWidth = 'min(100%, calc(100vh - 220px))';

  // Current board position derived from cursor
  const currentFen = cursor === 0 ? STARTING_FEN : history[cursor - 1].fen;

  // Chess instance at the current position
  const chess = useMemo(() => {
    const c = new Chess();
    c.load(currentFen);
    return c;
  }, [currentFen]);

  const turn   = chess.turn();
  const isOver = chess.isGameOver();

  const lastMoveSquares: [string, string] | null =
    cursor > 0 ? [history[cursor - 1].from, history[cursor - 1].to] : null;

  const legalMoveSquares = useMemo(
    () => legalMoves.map(m => ({ square: m.to, isCapture: !!m.captured })),
    [legalMoves],
  );

  // Derived arrow for the board
  const bestMoveArrow = arrowUCI
    ? { from: arrowUCI.slice(0, 2), to: arrowUCI.slice(2, 4) }
    : null;

  // Pre-compute SAN display for each PV line
  const displayLines = useMemo(() => {
    if (!multiPV) return null;
    return multiPV.lines.map(line => {
      const sans = pvToSan(currentFen, line.pv);
      return {
        rank:         line.rank,
        score:        line.score,
        depth:        line.depth,
        bestMoveUCI:  line.bestMove,
        bestMoveSan:  sans[0] ?? line.bestMove,
        continuation: sans.slice(1).join(' '),
      };
    });
  }, [multiPV, currentFen]);

  // Clear selection + arrow whenever position changes
  useEffect(() => {
    setArrowUCI(null);
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [cursor]);

  // Scroll active move into view
  useEffect(() => {
    activeMoveRef.current?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  // Initialize Stockfish on mount; destroy on unmount
  useEffect(() => {
    ensureEngineReady().catch(() => {});
    return () => { destroyEngine(); };
  }, []);

  // Run MultiPV evaluation after every position change
  useEffect(() => {
    let cancelled = false;
    setMultiPVLoading(true);
    evaluateMultiPV(currentFen, 18, 5).then(result => {
      if (!cancelled) {
        setMultiPV(result);
        setMultiPVLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setMultiPVLoading(false);
    });
    return () => { cancelled = true; };
  }, [currentFen]);

  // ── Hint ───────────────────────────────────────────────────────────────────

  const handleHint = useCallback(() => {
    if (isOver || multiPVLoading) return;
    const uci = multiPV?.lines[0]?.bestMove;
    if (!uci) return;
    setArrowUCI(a => a === uci ? null : uci);
  }, [isOver, multiPVLoading, multiPV]);

  const handleRowArrow = useCallback((uci: string) => {
    setArrowUCI(a => a === uci ? null : uci);
  }, []);

  // ── Core move logic ────────────────────────────────────────────────────────

  const makeMove = useCallback(
    (from: string, to: string): boolean => {
      const c = new Chess();
      c.load(currentFen);
      try {
        const result = c.move({ from, to, promotion: 'q' });
        if (!result) return false;
        const entry: HistoryEntry = { san: result.san, from: result.from, to: result.to, fen: c.fen() };
        setHistory(prev => [...prev.slice(0, cursor), entry]);
        setCursor(cursor + 1);
        setArrowUCI(null);
        setSelectedSquare(null);
        setLegalMoves([]);
        return true;
      } catch {
        return false;
      }
    },
    [currentFen, cursor],
  );

  const handleSquareClick = useCallback(
    (square: string) => {
      if (selectedSquare) {
        const hit = legalMoves.find(m => m.to === square);
        if (hit) {
          makeMove(selectedSquare, square);
          return;
        }
      }

      if (!isOver) {
        const piece = chess.get(square as Square);
        if (piece && piece.color === turn) {
          const moves = chess.moves({ square: square as Square, verbose: true }) as Move[];
          if (moves.length > 0) {
            setArrowUCI(null);
            setSelectedSquare(square);
            setLegalMoves(moves);
            return;
          }
        }
      }

      setSelectedSquare(null);
      setLegalMoves([]);
    },
    [selectedSquare, legalMoves, chess, turn, isOver, makeMove],
  );

  const handleDragMove = useCallback(
    (from: string, to: string): boolean => makeMove(from, to),
    [makeMove],
  );

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goTo = useCallback(
    (idx: number) => setCursor(Math.max(0, Math.min(idx, history.length))),
    [history.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft')  goTo(cursor - 1);
      if (e.key === 'ArrowRight') goTo(cursor + 1);
      if (e.key === 'Home')       goTo(0);
      if (e.key === 'End')        goTo(history.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cursor, goTo, history.length]);

  // ── Reset ──────────────────────────────────────────────────────────────────

  function handleReset() {
    if (history.length > 0 && !window.confirm('Reset the board? All moves will be cleared.')) return;
    setHistory([]);
    setCursor(0);
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  // ── Move list pairs ────────────────────────────────────────────────────────

  const movePairs = useMemo(() => {
    const pairs: [HistoryEntry | null, HistoryEntry | null][] = [];
    for (let i = 0; i < history.length; i += 2) {
      pairs.push([history[i] ?? null, history[i + 1] ?? null]);
    }
    return pairs;
  }, [history]);

  // ── Shared button styles ───────────────────────────────────────────────────

  const navBtnClass =
    'w-10 h-10 flex items-center justify-center text-base transition-colors ' +
    'disabled:opacity-30 focus:outline-none focus:ring-1 focus:ring-[var(--brand-green)] ' +
    'hover:bg-[var(--bg-tertiary)]';

  const hintIsActive = !!arrowUCI && arrowUCI === multiPV?.lines[0]?.bestMove;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex h-[calc(100vh-52px)] overflow-hidden"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* ── Center: eval bar + board ─────────────────────────────────────── */}
      <main
        aria-label="Playground chess board"
        className="flex flex-col items-center justify-start gap-2 p-4 overflow-y-auto flex-1 min-w-0"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="flex flex-col w-full mx-auto" style={{ maxWidth: boardAreaMaxWidth }}>

          {/* Eval bar + board */}
          <div className="flex items-stretch gap-1.5">
            <EvalBar score={multiPV?.lines[0]?.score} />
            <div className="flex-1">
              <ChessBoard
                fen={currentFen}
                onMove={handleDragMove}
                boardOrientation={flipped ? 'black' : 'white'}
                lastMoveSquares={lastMoveSquares}
                selectedSquare={selectedSquare}
                legalMoveSquares={legalMoveSquares}
                onSquareClick={handleSquareClick}
                bestMoveArrow={bestMoveArrow}
              />
            </div>
          </div>

          {/* Turn / game-over indicator */}
          <div className="flex items-center gap-2 mt-2 justify-center" aria-live="polite">
            {isOver ? (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {chess.isCheckmate()
                  ? `${turn === 'w' ? 'Black' : 'White'} wins by checkmate`
                  : 'Draw'}
              </span>
            ) : (
              <>
                <div
                  aria-hidden="true"
                  style={{
                    width: 10, height: 10, borderRadius: '50%',
                    backgroundColor: turn === 'w' ? '#ffffff' : '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.3)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {turn === 'w' ? 'White to move' : 'Black to move'}
                </span>
              </>
            )}
          </div>

          {/* Navigation controls */}
          <div role="group" aria-label="Move navigation" className="flex items-center justify-center gap-1 mt-1">
            {([
              { label: '⏮', aria: 'Go to start',     action: () => goTo(0),             disabled: cursor === 0 },
              { label: '◀', aria: 'Previous move',   action: () => goTo(cursor - 1),     disabled: cursor === 0 },
              { label: '▶', aria: 'Next move',       action: () => goTo(cursor + 1),     disabled: cursor >= history.length },
              { label: '⏭', aria: 'Go to last move', action: () => goTo(history.length), disabled: cursor >= history.length },
            ] as const).map(({ label, aria, action, disabled }) => (
              <button
                key={aria}
                onClick={action}
                aria-label={aria}
                disabled={disabled}
                className={navBtnClass}
                style={{ borderRadius: 4, color: 'var(--text-secondary)' }}
              >
                <span aria-hidden="true">{label}</span>
              </button>
            ))}

            <button
              onClick={() => setFlipped(f => !f)}
              aria-label={flipped ? 'Flip board to white' : 'Flip board to black'}
              title="Flip board"
              className={`${navBtnClass} ml-1`}
              style={{ borderRadius: 4, color: flipped ? 'var(--brand-green)' : 'var(--text-secondary)' }}
            >↕</button>

            <button
              onClick={handleReset}
              aria-label="Reset board"
              title="Reset board"
              className={navBtnClass}
              style={{ borderRadius: 4, color: 'var(--text-secondary)' }}
            >↺</button>
          </div>

          {/* Hint button */}
          <div className="flex justify-center mt-2">
            <button
              onClick={handleHint}
              disabled={multiPVLoading || isOver}
              aria-label={hintIsActive ? 'Hide hint' : 'Show hint'}
              title="Hint"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 14px', borderRadius: 4,
                border: '1px solid var(--bg-surface)',
                background: 'transparent',
                color: hintIsActive ? 'var(--brand-green)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: 500,
                cursor: multiPVLoading || isOver ? 'default' : 'pointer',
                opacity: isOver ? 0.3 : 1,
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {multiPVLoading ? (
                <span
                  aria-hidden="true"
                  style={{
                    width: 13, height: 13, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.15)',
                    borderTopColor: 'var(--text-secondary)',
                    display: 'inline-block',
                    animation: 'spin 0.7s linear infinite',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <Lightbulb size={13} aria-hidden="true" />
              )}
              Hint
            </button>
          </div>
        </div>
      </main>

      {/* ── Right: best moves + move history ────────────────────────────── */}
      <aside
        aria-label="Analysis panel"
        className="shrink-0 flex flex-col overflow-hidden"
        style={{
          width: RIGHT_WIDTH,
          backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* ── Best Moves ───────────────────────────────────────────────── */}
        <div className="shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Header */}
          <div
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px 6px',
            }}
          >
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
              color: 'var(--text-secondary)', textTransform: 'uppercase',
            }}>
              Best Moves
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.6 }}>
              {multiPV ? `Depth ${multiPV.depth} · Stockfish` : 'Stockfish'}
            </span>
          </div>

          {/* Body */}
          {isOver ? (
            <div style={{ padding: '16px 12px', textAlign: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                {chess.isCheckmate() ? 'Checkmate' : chess.isStalemate() ? 'Stalemate' : 'Draw'}
              </span>
            </div>
          ) : multiPVLoading && !multiPV ? (
            /* Skeleton — only shown on first load before any data exists */
            <div style={{ padding: '0 0 4px' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton-pulse"
                  style={{
                    margin: '4px 12px',
                    height: 28,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          ) : displayLines ? (
            /* Results — kept visible while updating (subtle dim) */
            <div
              key={multiPV?.depth}
              style={{ opacity: multiPVLoading ? 0.55 : 1, transition: 'opacity 0.15s' }}
              className="explanation-fade-in"
            >
              {displayLines.map(line => {
                const isRowActive = arrowUCI === line.bestMoveUCI;
                return (
                  <button
                    key={line.rank}
                    onClick={() => handleRowArrow(line.bestMoveUCI)}
                    aria-label={`Line ${line.rank}: ${line.bestMoveSan}`}
                    aria-pressed={isRowActive}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'flex-start',
                      gap: 6, padding: '5px 12px',
                      background: isRowActive ? 'var(--bg-tertiary)' : 'transparent',
                      border: 'none',
                      borderLeft: `2px solid ${isRowActive ? 'var(--brand-green)' : 'transparent'}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => {
                      if (!isRowActive) e.currentTarget.style.background = 'var(--bg-surface)';
                    }}
                    onMouseLeave={e => {
                      if (!isRowActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {/* Rank */}
                    <span style={{
                      fontSize: 11, color: 'var(--text-secondary)',
                      width: 14, flexShrink: 0, paddingTop: 1,
                    }}>
                      {line.rank}
                    </span>

                    {/* Score */}
                    <span style={{
                      fontFamily: '"Roboto Mono", monospace',
                      fontSize: 12, fontWeight: 700,
                      color: 'var(--text-primary)',
                      width: 44, flexShrink: 0,
                    }}>
                      {formatEvalLabel(line.score)}
                    </span>

                    {/* Move + continuation */}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        fontFamily: '"Roboto Mono", monospace',
                        fontSize: 13, fontWeight: 700,
                        color: 'var(--text-accent)',
                        marginRight: 6,
                      }}>
                        {line.bestMoveSan}
                      </span>
                      <span style={{
                        fontSize: 11, color: 'var(--text-secondary)',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', display: 'inline-block',
                        verticalAlign: 'middle', maxWidth: '100%',
                      }}>
                        {line.continuation}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* ── Move history ─────────────────────────────────────────────── */}
        {history.length === 0 ? null : (
          <ol
            aria-label="Move history"
            className="move-list overflow-y-auto flex-1 min-h-0 list-none m-0 p-0"
          >
            {movePairs.map(([white, black], pairIdx) => {
              const wi      = pairIdx * 2;
              const bi      = pairIdx * 2 + 1;
              const wActive = cursor === wi + 1;
              const bActive = cursor === bi + 1;
              return (
                <li
                  key={pairIdx}
                  className="flex items-stretch"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                >
                  <span
                    aria-hidden="true"
                    className="flex items-center shrink-0 select-none tabular-nums"
                    style={{ width: 32, paddingLeft: 8, fontSize: 12, color: 'var(--text-secondary)' }}
                  >
                    {pairIdx + 1}.
                  </span>

                  <div className="flex items-center flex-1 min-w-0">
                    {white && (
                      <button
                        ref={wActive ? activeMoveRef : undefined}
                        onClick={() => setCursor(wi + 1)}
                        aria-label={`Move ${pairIdx + 1} white: ${white.san}`}
                        aria-current={wActive ? 'true' : undefined}
                        className="move-btn"
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center',
                          padding: '4px 8px',
                          fontFamily: '"Roboto Mono", monospace',
                          fontSize: 14, lineHeight: 1.4,
                          color: wActive ? 'var(--text-accent)' : 'var(--text-primary)',
                          textAlign: 'left', cursor: 'pointer',
                          minWidth: 0, outline: 'none',
                        }}
                      >
                        {white.san}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center flex-1 min-w-0">
                    {black && (
                      <button
                        ref={bActive ? activeMoveRef : undefined}
                        onClick={() => setCursor(bi + 1)}
                        aria-label={`Move ${pairIdx + 1} black: ${black.san}`}
                        aria-current={bActive ? 'true' : undefined}
                        className="move-btn"
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center',
                          padding: '4px 8px',
                          fontFamily: '"Roboto Mono", monospace',
                          fontSize: 14, lineHeight: 1.4,
                          color: bActive ? 'var(--text-accent)' : 'var(--text-primary)',
                          textAlign: 'left', cursor: 'pointer',
                          minWidth: 0, outline: 'none',
                        }}
                      >
                        {black.san}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </aside>
    </div>
  );
}
