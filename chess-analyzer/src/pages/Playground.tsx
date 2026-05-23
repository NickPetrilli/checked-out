import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import { Lightbulb } from 'lucide-react';
import ChessBoard from '../components/ChessBoard';
import { EvalBar } from '../utils/evalBar';
import { evaluatePosition, ensureEngineReady, destroyEngine } from '../services/stockfish';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const RIGHT_WIDTH  = 340;

interface HistoryEntry {
  san:  string;
  from: string;
  to:   string;
  fen:  string; // position AFTER the move
}

export default function Playground() {
  const [history,        setHistory]        = useState<HistoryEntry[]>([]);
  const [cursor,         setCursor]         = useState(0); // 0 = starting position
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves,     setLegalMoves]     = useState<Move[]>([]);
  const [flipped,        setFlipped]        = useState(false);
  const [evalScore,      setEvalScore]      = useState<number | undefined>(undefined);
  const [hintArrow,      setHintArrow]      = useState<{ from: string; to: string } | null>(null);
  const [hintLoading,    setHintLoading]    = useState(false);

  const activeMoveRef    = useRef<HTMLButtonElement>(null);
  const hintCancelRef    = useRef(false);
  const boardAreaMaxWidth = 'min(100%, calc(100vh - 220px))';

  // Current board position derived from cursor
  const currentFen = cursor === 0 ? STARTING_FEN : history[cursor - 1].fen;

  // Chess instance at the current position — used for legal move lookup and turn info
  const chess = useMemo(() => {
    const c = new Chess();
    c.load(currentFen);
    return c;
  }, [currentFen]);

  const turn      = chess.turn();          // 'w' | 'b'
  const isOver    = chess.isGameOver();

  const lastMoveSquares: [string, string] | null =
    cursor > 0 ? [history[cursor - 1].from, history[cursor - 1].to] : null;

  // Dot/ring overlays for the currently selected piece's legal destinations
  const legalMoveSquares = useMemo(
    () => legalMoves.map(m => ({ square: m.to, isCapture: !!m.captured })),
    [legalMoves],
  );

  // Clear piece selection and hint whenever the board position changes
  useEffect(() => {
    hintCancelRef.current = true;
    setHintArrow(null);
    setHintLoading(false);
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

  // Evaluate current position after every cursor change
  useEffect(() => {
    let cancelled = false;
    evaluatePosition(currentFen, 16).then(result => {
      if (!cancelled) setEvalScore(result.score);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [currentFen]);

  // ── Hint ───────────────────────────────────────────────────────────────────

  const handleHint = useCallback(async () => {
    if (isOver) return;
    if (hintArrow) {
      setHintArrow(null);
      return;
    }
    hintCancelRef.current = false;
    setHintLoading(true);
    try {
      const result = await evaluatePosition(currentFen, 18);
      if (!hintCancelRef.current) {
        const uci = result.bestMove;
        if (uci && uci.length >= 4) {
          setHintArrow({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
        }
      }
    } catch {
      // ignore
    }
    if (!hintCancelRef.current) setHintLoading(false);
  }, [hintArrow, currentFen, isOver]);

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
        setHintArrow(null);
        setSelectedSquare(null);
        setLegalMoves([]);
        return true;
      } catch {
        return false;
      }
    },
    [currentFen, cursor],
  );

  // Click-to-move: select a piece, then click a legal destination
  const handleSquareClick = useCallback(
    (square: string) => {
      // If this square is a legal destination for the selected piece → move
      if (selectedSquare) {
        const hit = legalMoves.find(m => m.to === square);
        if (hit) {
          makeMove(selectedSquare, square);
          return;
        }
      }

      // Try to select a piece that belongs to the side to move
      if (!isOver) {
        const piece = chess.get(square as Square);
        if (piece && piece.color === turn) {
          const moves = chess.moves({ square: square as Square, verbose: true }) as Move[];
          if (moves.length > 0) {
            setHintArrow(null);
            setSelectedSquare(square);
            setLegalMoves(moves);
            return;
          }
        }
      }

      // Clicked elsewhere → deselect
      setSelectedSquare(null);
      setLegalMoves([]);
    },
    [selectedSquare, legalMoves, chess, turn, isOver, makeMove],
  );

  // Drag-to-move
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex h-[calc(100vh-52px)] overflow-hidden"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* ── Center: eval bar placeholder + board ────────────────────────── */}
      <main
        aria-label="Playground chess board"
        className="flex flex-col items-center justify-start gap-2 p-4 overflow-y-auto flex-1 min-w-0"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="flex flex-col w-full mx-auto" style={{ maxWidth: boardAreaMaxWidth }}>

          {/* Eval bar + board */}
          <div className="flex items-stretch gap-1.5">
            <EvalBar score={evalScore} />
            <div className="flex-1">
              <ChessBoard
                fen={currentFen}
                onMove={handleDragMove}
                boardOrientation={flipped ? 'black' : 'white'}
                lastMoveSquares={lastMoveSquares}
                selectedSquare={selectedSquare}
                legalMoveSquares={legalMoveSquares}
                onSquareClick={handleSquareClick}
                bestMoveArrow={hintArrow}
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
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
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
          <div
            role="group"
            aria-label="Move navigation"
            className="flex items-center justify-center gap-1 mt-1"
          >
            {([
              { label: '⏮', aria: 'Go to start',     action: () => goTo(0),               disabled: cursor === 0 },
              { label: '◀', aria: 'Previous move',   action: () => goTo(cursor - 1),       disabled: cursor === 0 },
              { label: '▶', aria: 'Next move',       action: () => goTo(cursor + 1),       disabled: cursor >= history.length },
              { label: '⏭', aria: 'Go to last move', action: () => goTo(history.length),   disabled: cursor >= history.length },
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

            {/* Flip board */}
            <button
              onClick={() => setFlipped(f => !f)}
              aria-label={flipped ? 'Flip board to white' : 'Flip board to black'}
              title="Flip board"
              className={`${navBtnClass} ml-1`}
              style={{ borderRadius: 4, color: flipped ? 'var(--brand-green)' : 'var(--text-secondary)' }}
            >
              ↕
            </button>

            {/* Reset board */}
            <button
              onClick={handleReset}
              aria-label="Reset board"
              title="Reset board"
              className={navBtnClass}
              style={{ borderRadius: 4, color: 'var(--text-secondary)' }}
            >
              ↺
            </button>
          </div>

          {/* Hint button */}
          <div className="flex justify-center mt-2">
            <button
              onClick={handleHint}
              disabled={hintLoading || isOver}
              aria-label={hintArrow ? 'Hide hint' : 'Show hint'}
              title="Hint"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 14px',
                borderRadius: 4,
                border: '1px solid var(--bg-surface)',
                background: 'transparent',
                color: hintArrow ? 'var(--brand-green)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: hintLoading || isOver ? 'default' : 'pointer',
                opacity: isOver ? 0.3 : 1,
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {hintLoading ? (
                <span
                  aria-hidden="true"
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: '50%',
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

      {/* ── Right: move history ──────────────────────────────────────────── */}
      <aside
        aria-label="Move history"
        className="shrink-0 flex flex-col overflow-hidden"
        style={{
          width: RIGHT_WIDTH,
          backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {history.length === 0 ? (
          <div className="flex flex-col flex-1 items-center justify-center">
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', opacity: 0.5 }}>
              Best Moves will appear here
            </p>
          </div>
        ) : (
          <ol
            aria-label="Move list"
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
                  {/* Move number */}
                  <span
                    aria-hidden="true"
                    className="flex items-center shrink-0 select-none tabular-nums"
                    style={{ width: 32, paddingLeft: 8, fontSize: 12, color: 'var(--text-secondary)' }}
                  >
                    {pairIdx + 1}.
                  </span>

                  {/* White move */}
                  <div className="flex items-center flex-1 min-w-0">
                    {white && (
                      <button
                        ref={wActive ? activeMoveRef : undefined}
                        onClick={() => setCursor(wi + 1)}
                        aria-label={`Move ${pairIdx + 1} white: ${white.san}`}
                        aria-current={wActive ? 'true' : undefined}
                        className="move-btn"
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px 8px',
                          fontFamily: '"Roboto Mono", monospace',
                          fontSize: 14,
                          lineHeight: 1.4,
                          color: wActive ? 'var(--text-accent)' : 'var(--text-primary)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          minWidth: 0,
                          outline: 'none',
                        }}
                      >
                        {white.san}
                      </button>
                    )}
                  </div>

                  {/* Black move */}
                  <div className="flex items-center flex-1 min-w-0">
                    {black && (
                      <button
                        ref={bActive ? activeMoveRef : undefined}
                        onClick={() => setCursor(bi + 1)}
                        aria-label={`Move ${pairIdx + 1} black: ${black.san}`}
                        aria-current={bActive ? 'true' : undefined}
                        className="move-btn"
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px 8px',
                          fontFamily: '"Roboto Mono", monospace',
                          fontSize: 14,
                          lineHeight: 1.4,
                          color: bActive ? 'var(--text-accent)' : 'var(--text-primary)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          minWidth: 0,
                          outline: 'none',
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
