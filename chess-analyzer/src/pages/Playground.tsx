import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, Palette } from 'lucide-react';
import ChessBoard from '../components/ChessBoard';
import { EvalBar, formatEvalLabel } from '../utils/evalBar';
import { evaluateMultiPV, ensureEngineReady, destroyEngine, getBotMove } from '../services/stockfish';
import type { MultiPVResult } from '../services/stockfish';
import { PIECE_SETS, loadSavedPieceSet, getKingThumbnail } from '../utils/pieceSets';
import { BOARD_THEMES, loadSavedTheme } from '../utils/boardThemes';
import type { BoardTheme } from '../utils/boardThemes';
import { detectOpening } from '../utils/openings';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const RIGHT_WIDTH  = 340;

const ELO_PRESETS = [
  { elo: 500,  label: 'Beginner',     skill: 1  },
  { elo: 800,  label: 'Casual',       skill: 4  },
  { elo: 1200, label: 'Intermediate', skill: 8  },
  { elo: 1500, label: 'Club Player',  skill: 12 },
  { elo: 2000, label: 'Advanced',     skill: 16 },
  { elo: 2800, label: 'Maximum',      skill: 20 },
] as const;

interface HistoryEntry {
  san:  string;
  from: string;
  to:   string;
  fen:  string; // position AFTER the move
}

interface GameResult {
  message: string;
  winner: 'player' | 'bot' | 'draw';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function eloToSkill(elo: number): number {
  const preset = [...ELO_PRESETS].reverse().find(p => elo >= p.elo);
  return preset?.skill ?? ELO_PRESETS[0].skill;
}

function eloLabel(elo: number): string {
  return ELO_PRESETS.find(p => p.elo === elo)?.label ?? String(elo);
}

function determineGameResult(chess: Chess, playerColor: 'w' | 'b'): GameResult {
  if (chess.isCheckmate()) {
    const loser = chess.turn();
    return loser === playerColor
      ? { message: 'Checkmate — Bot Wins', winner: 'bot' }
      : { message: 'Checkmate — You Win! 🎉', winner: 'player' };
  }
  return { message: 'Draw', winner: 'draw' };
}

function exportAsPgn(history: HistoryEntry[], playerColor: 'w' | 'b', elo: number): string {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '.');
  const whiteName = playerColor === 'w' ? 'You' : `Stockfish (${elo})`;
  const blackName = playerColor === 'b' ? 'You' : `Stockfish (${elo})`;
  let pgn = `[Event "Playground"]\n[Date "${date}"]\n[White "${whiteName}"]\n[Black "${blackName}"]\n\n`;
  for (let i = 0; i < history.length; i += 2) {
    pgn += `${Math.floor(i / 2) + 1}. ${history[i].san}`;
    if (history[i + 1]) pgn += ` ${history[i + 1].san}`;
    pgn += ' ';
  }
  return pgn.trim();
}

function sanToEnglish(san: string): string {
  if (san.startsWith('O-O-O') || san.startsWith('0-0-0')) return 'Castle queenside';
  if (san.startsWith('O-O')   || san.startsWith('0-0'))   return 'Castle kingside';

  const isCheck = san.endsWith('+') || san.endsWith('#');
  const s = san.replace(/[+#]$/, '');

  const promMatch = s.match(/=([QRBN])$/);
  if (promMatch) {
    const names: Record<string, string> = { Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight' };
    return `Pawn promotes to ${names[promMatch[1]] ?? promMatch[1]}${isCheck ? ', check' : ''}`;
  }

  const pieceMap: Record<string, string> = { N: 'Knight', B: 'Bishop', R: 'Rook', Q: 'Queen', K: 'King' };
  const pieceName = (s[0] && pieceMap[s[0]]) ? pieceMap[s[0]] : 'Pawn';
  const isCapture  = s.includes('x');
  const target     = s.slice(-2);
  const desc = isCapture ? `${pieceName} takes ${target}` : `${pieceName} to ${target}`;
  return isCheck ? `${desc}, check` : desc;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Playground() {
  const navigate = useNavigate();

  // ── Core state ─────────────────────────────────────────────────────────────
  const [history,        setHistory]        = useState<HistoryEntry[]>([]);
  const [cursor,         setCursor]         = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves,     setLegalMoves]     = useState<Move[]>([]);
  const [flipped,        setFlipped]        = useState(false);
  const [multiPV,        setMultiPV]        = useState<MultiPVResult | null>(null);
  const [multiPVLoading, setMultiPVLoading] = useState(true);
  const [arrowUCI,       setArrowUCI]       = useState<string | null>(null);
  const [pieceSet,       setPieceSetState]  = useState(loadSavedPieceSet);
  const [boardTheme,     setBoardTheme]     = useState<BoardTheme>(loadSavedTheme);
  const [themePickerOpen,  setThemePickerOpen]  = useState(false);
  const [piecePickerOpen,  setPiecePickerOpen]  = useState(false);

  // ── Mode / bot state ───────────────────────────────────────────────────────
  const [playMode,        setPlayMode]       = useState<'bot' | 'freeplay'>('bot');
  const [playerColor,     setPlayerColor]    = useState<'w' | 'b'>('w');
  const [pendingBotElo,   setPendingBotElo]  = useState(1200);
  const [activeElo,       setActiveElo]      = useState(1200);
  const [botThinking,     setBotThinking]    = useState(false);
  const [gameResult,      setGameResult]     = useState<GameResult | null>(null);
  const [colorPickerDone, setColorPickerDone] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const activeMoveRef   = useRef<HTMLButtonElement>(null);
  const themePickerRef  = useRef<HTMLDivElement>(null);
  const piecePickerRef  = useRef<HTMLDivElement>(null);
  const botMoveTokenRef = useRef(0);

  const boardAreaMaxWidth = 'min(100%, calc(100vh - 220px))';

  // ── Derived ────────────────────────────────────────────────────────────────

  const currentFen = cursor === 0 ? STARTING_FEN : history[cursor - 1].fen;

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

  const bestMoveArrow = arrowUCI
    ? { from: arrowUCI.slice(0, 2), to: arrowUCI.slice(2, 4) }
    : null;

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
        english:      sanToEnglish(sans[0] ?? line.bestMove),
      };
    });
  }, [multiPV, currentFen]);

  // In bot mode: can the player interact with the board right now?
  const playerCanMove =
    playMode === 'freeplay'
      ? !isOver
      : !isOver && !botThinking && !gameResult && turn === playerColor && cursor >= history.length;

  const showColorPicker  = playMode === 'bot' && !colorPickerDone && !botThinking;
  const showGameResult   = playMode === 'bot' && !!gameResult;

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    setArrowUCI(null);
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [cursor]);

  useEffect(() => {
    activeMoveRef.current?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  useEffect(() => {
    ensureEngineReady().catch(() => {});
    return () => { destroyEngine(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMultiPVLoading(true);
    evaluateMultiPV(currentFen, 18, 5).then(result => {
      if (!cancelled) { setMultiPV(result); setMultiPVLoading(false); }
    }).catch(() => {
      if (!cancelled) setMultiPVLoading(false);
    });
    return () => { cancelled = true; };
  }, [currentFen]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node))
        setThemePickerOpen(false);
      if (piecePickerRef.current && !piecePickerRef.current.contains(e.target as Node))
        setPiecePickerOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // ── Piece set ──────────────────────────────────────────────────────────────

  const selectPieceSet = useCallback((id: string) => {
    const found = PIECE_SETS.find(s => s.id === id);
    if (!found) return;
    localStorage.setItem('chess-piece-set', id);
    setPieceSetState(found);
  }, []);

  // ── Bot logic ──────────────────────────────────────────────────────────────

  const scheduleBotMove = useCallback(async (fen: string, pColor: 'w' | 'b', elo: number) => {
    const token = ++botMoveTokenRef.current;
    setBotThinking(true);
    try {
      if (botMoveTokenRef.current !== token) return;

      const uci = await getBotMove(fen, elo, eloToSkill(elo));
      if (botMoveTokenRef.current !== token || !uci) return;

      const c = new Chess();
      c.load(fen);
      const result = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: (uci[4] ?? 'q') as 'q' });
      if (!result || botMoveTokenRef.current !== token) return;

      const entry: HistoryEntry = { san: result.san, from: result.from, to: result.to, fen: c.fen() };
      setHistory(prev => [...prev, entry]);
      setCursor(prev => prev + 1);

      if (c.isGameOver()) setGameResult(determineGameResult(c, pColor));
    } finally {
      if (botMoveTokenRef.current === token) setBotThinking(false);
    }
  }, []);

  // ── Core move logic ────────────────────────────────────────────────────────

  const makeMove = useCallback(
    (from: string, to: string): string | null => {
      const c = new Chess();
      c.load(currentFen);
      try {
        const result = c.move({ from, to, promotion: 'q' });
        if (!result) return null;
        const entry: HistoryEntry = { san: result.san, from: result.from, to: result.to, fen: c.fen() };
        setHistory(prev => [...prev.slice(0, cursor), entry]);
        setCursor(cursor + 1);
        setArrowUCI(null);
        setSelectedSquare(null);
        setLegalMoves([]);
        return c.fen();
      } catch {
        return null;
      }
    },
    [currentFen, cursor],
  );

  const afterPlayerMove = useCallback((newFen: string, pColor: 'w' | 'b', elo: number) => {
    if (playMode !== 'bot') return;
    const c = new Chess();
    c.load(newFen);
    if (c.isGameOver()) { setGameResult(determineGameResult(c, pColor)); return; }
    if (c.turn() !== pColor) scheduleBotMove(newFen, pColor, elo);
  }, [playMode, scheduleBotMove]);

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragBegin = useCallback((square: string) => {
    if (!playerCanMove) return;
    const piece = chess.get(square as Square);
    if (!piece) return;
    const allowedColor = playMode === 'bot' ? playerColor : turn;
    if (piece.color !== allowedColor) return;
    const moves = chess.moves({ square: square as Square, verbose: true }) as Move[];
    if (moves.length === 0) return;
    setArrowUCI(null);
    setSelectedSquare(square);
    setLegalMoves(moves);
  }, [chess, turn, playerCanMove, playMode, playerColor]);

  const handleDragEnd = useCallback(() => {
    setSelectedSquare(null);
    setLegalMoves([]);
  }, []);

  // ── Hint ───────────────────────────────────────────────────────────────────

  const handleHint = useCallback(() => {
    if (isOver || multiPVLoading || botThinking) return;
    const uci = multiPV?.lines[0]?.bestMove;
    if (!uci) return;
    setArrowUCI(a => a === uci ? null : uci);
  }, [isOver, multiPVLoading, multiPV, botThinking]);

  const handleRowArrow = useCallback((uci: string) => {
    setArrowUCI(a => a === uci ? null : uci);
  }, []);

  // ── Square click ───────────────────────────────────────────────────────────

  const handleSquareClick = useCallback(
    (square: string) => {
      if (selectedSquare) {
        const hit = legalMoves.find(m => m.to === square);
        if (hit) {
          const newFen = makeMove(selectedSquare, square);
          if (newFen !== null) afterPlayerMove(newFen, playerColor, activeElo);
          return;
        }
      }

      if (!playerCanMove) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      const piece = chess.get(square as Square);
      if (piece) {
        const allowedColor = playMode === 'bot' ? playerColor : turn;
        if (piece.color === allowedColor && piece.color === turn) {
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
    [selectedSquare, legalMoves, chess, turn, playerCanMove, makeMove, afterPlayerMove, playMode, playerColor, activeElo],
  );

  const handleDragMove = useCallback(
    (from: string, to: string): boolean => {
      if (!playerCanMove) return false;
      const newFen = makeMove(from, to);
      if (newFen !== null) afterPlayerMove(newFen, playerColor, activeElo);
      return newFen !== null;
    },
    [makeMove, afterPlayerMove, playerCanMove, playerColor, activeElo],
  );

  // ── Color selection ────────────────────────────────────────────────────────

  const handleColorSelect = useCallback((color: 'w' | 'b') => {
    setPlayerColor(color);
    setColorPickerDone(true);
    if (color === 'b') {
      scheduleBotMove(STARTING_FEN, 'b', activeElo);
    }
  }, [scheduleBotMove, activeElo]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goTo = useCallback(
    (idx: number) => setCursor(Math.max(0, Math.min(idx, history.length))),
    [history.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (botThinking) return;
      if (e.key === 'ArrowLeft')  goTo(cursor - 1);
      if (e.key === 'ArrowRight') goTo(cursor + 1);
      if (e.key === 'Home')       goTo(0);
      if (e.key === 'End')        goTo(history.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cursor, goTo, history.length, botThinking]);

  // ── Opening detection ──────────────────────────────────────────────────────

  const openingName = useMemo(
    () => detectOpening(history.map(e => e.san)),
    [history],
  );

  // ── Reset helpers ──────────────────────────────────────────────────────────

  function doReset(newMode?: 'bot' | 'freeplay', newElo?: number) {
    botMoveTokenRef.current++; // cancel any pending bot move
    setBotThinking(false);
    setHistory([]);
    setCursor(0);
    setSelectedSquare(null);
    setLegalMoves([]);
    setArrowUCI(null);
    setGameResult(null);
    setColorPickerDone(false);
    setPlayerColor('w');
    if (newMode !== undefined) setPlayMode(newMode);
    if (newElo  !== undefined) setActiveElo(newElo);
  }

  function handleReset() {
    if (history.length > 0 && !window.confirm('Reset the board? All moves will be cleared.')) return;
    doReset(undefined, pendingBotElo);
  }

  function handlePlayAgain() {
    doReset(undefined, pendingBotElo);
  }

  function handleModeSwitch(mode: 'bot' | 'freeplay') {
    if (mode === playMode) return;
    doReset(mode, pendingBotElo);
  }

  // ── Review Game ────────────────────────────────────────────────────────────

  function handleReviewGame() {
    const pgn = exportAsPgn(history, playerColor, activeElo);
    sessionStorage.setItem('playground-review-pgn', pgn);
    navigate('/analyzer');
  }

  // ── Move list pairs ────────────────────────────────────────────────────────

  const movePairs = useMemo(() => {
    const pairs: [HistoryEntry | null, HistoryEntry | null][] = [];
    for (let i = 0; i < history.length; i += 2) {
      pairs.push([history[i] ?? null, history[i + 1] ?? null]);
    }
    return pairs;
  }, [history]);

  // ── Shared styles ──────────────────────────────────────────────────────────

  const navBtnClass =
    'w-10 h-10 flex items-center justify-center text-base transition-colors ' +
    'disabled:opacity-30 focus:outline-none focus:ring-1 focus:ring-[var(--brand-green)] ' +
    'hover:bg-[var(--bg-tertiary)]';

  const hintIsActive = !!arrowUCI && arrowUCI === multiPV?.lines[0]?.bestMove;

  // Nameplate helpers (top = black when not flipped, white when flipped)
  const bottomColor: 'w' | 'b' = flipped ? 'b' : 'w';
  const topColor:    'w' | 'b' = flipped ? 'w' : 'b';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="wood-grain flex h-[calc(100vh-60px)] overflow-hidden"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* ── Center: board area ───────────────────────────────────────────── */}
      <main
        aria-label="Playground chess board"
        className="wood-grain flex flex-col items-center justify-start gap-2 p-4 overflow-y-auto flex-1 min-w-0"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="flex flex-col w-full mx-auto" style={{ maxWidth: boardAreaMaxWidth }}>

          {/* Mode toggle */}
          <div
            className="flex justify-center mb-3"
            style={{
              padding: 3,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              display: 'inline-flex',
              alignSelf: 'center',
              width: 'fit-content',
              margin: '0 auto 12px',
            }}
          >
            {(['bot', 'freeplay'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => handleModeSwitch(mode)}
                aria-pressed={playMode === mode}
                style={{
                  padding: '6px 20px',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  background: playMode === mode
                    ? 'linear-gradient(135deg, var(--brand-green) 0%, var(--brand-green-dark) 100%)'
                    : 'transparent',
                  color: playMode === mode ? '#fff' : 'var(--text-secondary)',
                  boxShadow: playMode === mode ? '0 1px 8px rgba(82,176,68,0.4)' : 'none',
                  transition: 'all 0.18s ease',
                  letterSpacing: '-0.01em',
                }}
                onMouseEnter={e => {
                  if (playMode !== mode) {
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }
                }}
                onMouseLeave={e => {
                  if (playMode !== mode) {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {mode === 'bot' ? 'Play Bot' : 'Free Play'}
              </button>
            ))}
          </div>

          {/* Bot strength selector (bot mode only) */}
          {playMode === 'bot' && (
            <div className="flex items-center justify-center gap-3 mb-3">
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Bot Strength
              </span>
              <select
                value={pendingBotElo}
                onChange={e => setPendingBotElo(Number(e.target.value))}
                aria-label="Bot strength"
                className="input-premium cursor-pointer"
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                {ELO_PRESETS.map(preset => (
                  <option key={preset.elo} value={preset.elo}>
                    {preset.elo} — {preset.label}
                  </option>
                ))}
              </select>
              {pendingBotElo !== activeElo && (
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', opacity: 0.7 }}>
                  applies next game
                </span>
              )}
            </div>
          )}

          {/* Color picker (bot mode, before game starts) */}
          {showColorPicker && (
            <div className="flex flex-col items-center gap-3 mb-3">
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--text-secondary)',
                }}
              >
                Play as
              </span>
              <div className="flex gap-3">
                {(['w', 'b'] as const).map(color => (
                  <button
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    className="cursor-pointer"
                    style={{
                      padding: '10px 26px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(82,176,68,0.1)';
                      e.currentTarget.style.borderColor = 'rgba(82,176,68,0.3)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(82,176,68,0.15)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {color === 'w' ? '♔ White' : '♚ Black'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Theme + Piece pickers — top-right above board */}
          <div className="flex justify-end mb-1 gap-1">

            {/* Piece picker */}
            <div className="relative" ref={piecePickerRef}>
              <button
                onClick={() => { setPiecePickerOpen(o => !o); setThemePickerOpen(false); }}
                aria-label="Change piece set"
                title="Piece set"
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>♟</span>
                <span>Pieces</span>
              </button>
              {piecePickerOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-2xl p-3"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    minWidth: 180,
                  }}
                >
                  <p className="text-xs font-semibold mb-2.5 px-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Piece style
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {PIECE_SETS.map(set => {
                      const isActive = pieceSet.id === set.id;
                      return (
                        <button
                          key={set.id}
                          onClick={() => { selectPieceSet(set.id); setPiecePickerOpen(false); }}
                          aria-label={`Use ${set.name} pieces`}
                          aria-pressed={isActive}
                          className="flex flex-col items-center gap-1 p-1.5 rounded-md transition-colors"
                          style={{
                            backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
                            outline: isActive ? '2px solid var(--brand-green)' : 'none',
                            outlineOffset: -2,
                          }}
                        >
                          <div style={{ width: 32, height: 32 }}>
                            {getKingThumbnail(set)}
                          </div>
                          <span className="text-xs leading-tight" style={{ color: 'var(--text-secondary)' }}>
                            {set.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Theme picker */}
            <div className="relative" ref={themePickerRef}>
              <button
                onClick={() => { setThemePickerOpen(o => !o); setPiecePickerOpen(false); }}
                aria-label="Change board theme"
                title="Board theme"
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Theme</span>
              </button>
              {themePickerOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-2xl p-3 w-56"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <p className="text-xs font-semibold mb-2.5 px-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Board color
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {BOARD_THEMES.map(theme => (
                      <button
                        key={theme.id}
                        onClick={() => {
                          setBoardTheme(theme);
                          localStorage.setItem('chessboard-theme', theme.id);
                          setThemePickerOpen(false);
                        }}
                        aria-label={theme.name}
                        title={theme.name}
                        className={[
                          'flex flex-col items-center gap-1 p-1.5 rounded-md transition-colors',
                          boardTheme.id === theme.id ? 'ring-2 ring-[var(--brand-green)]' : '',
                        ].join(' ')}
                        style={{
                          backgroundColor: boardTheme.id === theme.id ? 'var(--bg-surface)' : 'transparent',
                        }}
                      >
                        <div
                          className="grid grid-cols-2 w-8 h-8 rounded-sm overflow-hidden"
                          style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          <div style={{ backgroundColor: theme.light }} />
                          <div style={{ backgroundColor: theme.dark }} />
                          <div style={{ backgroundColor: theme.dark }} />
                          <div style={{ backgroundColor: theme.light }} />
                        </div>
                        <span className="text-xs leading-tight text-center" style={{ color: 'var(--text-secondary)' }}>
                          {theme.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top player nameplate (bot mode) */}
          {playMode === 'bot' && colorPickerDone && (
            <div className="flex items-center gap-2 px-1 mb-1">
              {topColor !== playerColor ? (
                /* Bot nameplate */
                <>
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      backgroundColor: 'rgba(30,28,25,0.85)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, color: 'var(--text-secondary)',
                    }}
                    aria-hidden="true"
                  >S</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Stockfish
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    · {activeElo} ({eloLabel(activeElo)})
                  </span>
                  {botThinking && turn === (playerColor === 'w' ? 'b' : 'w') && (
                    <span
                      aria-label="Bot is thinking"
                      style={{
                        marginLeft: 4,
                        width: 12, height: 12, borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.15)',
                        borderTopColor: 'var(--text-secondary)',
                        display: 'inline-block',
                        animation: 'spin 0.7s linear infinite',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </>
              ) : (
                /* Player nameplate at top (flipped) */
                <>
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      backgroundColor: 'rgba(240,217,181,0.12)',
                      border: '1px solid rgba(240,217,181,0.22)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, color: 'var(--text-secondary)',
                    }}
                    aria-hidden="true"
                  >Y</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-accent)' }}>You</span>
                  <span
                    style={{
                      marginLeft: 2,
                      padding: '1px 6px', borderRadius: 3,
                      backgroundColor: 'var(--brand-green)', color: '#fff',
                      fontSize: 11, fontWeight: 700,
                    }}
                  >You</span>
                </>
              )}
            </div>
          )}

          {/* Eval bar + board + game-result overlay */}
          <div className="flex items-stretch gap-1.5 relative">
            <EvalBar score={multiPV?.lines[0]?.score} />
            <div className="flex-1 relative">
              <ChessBoard
                fen={currentFen}
                onMove={handleDragMove}
                boardOrientation={flipped ? 'black' : 'white'}
                lastMoveSquares={lastMoveSquares}
                selectedSquare={selectedSquare}
                legalMoveSquares={legalMoveSquares}
                onSquareClick={handleSquareClick}
                onDragBegin={handleDragBegin}
                onDragEnd={handleDragEnd}
                bestMoveArrow={bestMoveArrow}
                pieces={pieceSet.pieces}
                darkSquareStyle={{ backgroundColor: boardTheme.dark }}
                lightSquareStyle={{ backgroundColor: boardTheme.light }}
              />

              {/* Game result overlay */}
              {showGameResult && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    borderRadius: 4,
                    zIndex: 20,
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(18, 10, 4, 0.92)',
                      borderRadius: 16,
                      padding: '28px 36px',
                      textAlign: 'center',
                      border: '1px solid rgba(212,168,67,0.18)',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 22, fontWeight: 800, color: 'var(--text-accent)',
                        marginBottom: 6, letterSpacing: '-0.03em',
                      }}
                    >
                      {gameResult!.message}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, opacity: 0.8 }}>
                      {gameResult!.winner === 'player'
                        ? 'Well played!'
                        : gameResult!.winner === 'bot'
                          ? 'Better luck next time.'
                          : 'Game drawn.'}
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                      <button
                        onClick={handlePlayAgain}
                        className="btn-primary cursor-pointer"
                        style={{ padding: '9px 22px', borderRadius: 9, fontSize: 13, fontWeight: 700 }}
                      >
                        Play Again
                      </button>
                      <button
                        onClick={handleReviewGame}
                        className="btn-secondary cursor-pointer"
                        style={{ padding: '9px 22px', borderRadius: 9, fontSize: 13 }}
                      >
                        Review Game
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom player nameplate (bot mode) */}
          {playMode === 'bot' && colorPickerDone && (
            <div className="flex items-center gap-2 px-1 mt-1">
              {bottomColor !== playerColor ? (
                /* Bot nameplate */
                <>
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      backgroundColor: 'rgba(30,28,25,0.85)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, color: 'var(--text-secondary)',
                    }}
                    aria-hidden="true"
                  >S</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Stockfish
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    · {activeElo} ({eloLabel(activeElo)})
                  </span>
                  {botThinking && turn === (playerColor === 'w' ? 'b' : 'w') && (
                    <span
                      aria-label="Bot is thinking"
                      style={{
                        marginLeft: 4,
                        width: 12, height: 12, borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.15)',
                        borderTopColor: 'var(--text-secondary)',
                        display: 'inline-block',
                        animation: 'spin 0.7s linear infinite',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </>
              ) : (
                /* Player nameplate at bottom */
                <>
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      backgroundColor: 'rgba(240,217,181,0.12)',
                      border: '1px solid rgba(240,217,181,0.22)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, color: 'var(--text-secondary)',
                    }}
                    aria-hidden="true"
                  >Y</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-accent)' }}>You</span>
                  <span
                    style={{
                      marginLeft: 2,
                      padding: '1px 6px', borderRadius: 3,
                      backgroundColor: 'var(--brand-green)', color: '#fff',
                      fontSize: 11, fontWeight: 700,
                    }}
                  >You</span>
                </>
              )}
            </div>
          )}

          {/* Turn / game-over indicator (free play or pre-colorpicker in bot mode) */}
          {(playMode === 'freeplay' || !colorPickerDone) && (
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
          )}

          {/* Navigation controls */}
          <div role="group" aria-label="Move navigation" className="flex items-center justify-center gap-1 mt-1">
            {([
              { label: '⏮', aria: 'Go to start',     action: () => goTo(0),             disabled: cursor === 0 || botThinking },
              { label: '◀', aria: 'Previous move',   action: () => goTo(cursor - 1),     disabled: cursor === 0 || botThinking },
              { label: '▶', aria: 'Next move',       action: () => goTo(cursor + 1),     disabled: cursor >= history.length || botThinking },
              { label: '⏭', aria: 'Go to last move', action: () => goTo(history.length), disabled: cursor >= history.length || botThinking },
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
              disabled={multiPVLoading || isOver || botThinking}
              aria-label={hintIsActive ? 'Hide hint' : 'Show hint'}
              title="Hint"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 14px', borderRadius: 4,
                border: '1px solid var(--bg-surface)',
                background: 'transparent',
                color: hintIsActive ? 'var(--brand-green)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: 500,
                cursor: multiPVLoading || isOver || botThinking ? 'default' : 'pointer',
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
        className="wood-grain shrink-0 flex flex-col overflow-hidden"
        style={{
          width: RIGHT_WIDTH,
          backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* ── Best Moves ───────────────────────────────────────────────── */}
        <div className="shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px 6px' }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Best Moves
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.6 }}>
              {multiPV ? `Depth ${multiPV.depth} · Stockfish` : 'Stockfish'}
            </span>
          </div>

          {isOver ? (
            <div style={{ padding: '16px 12px', textAlign: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                {chess.isCheckmate() ? 'Checkmate' : chess.isStalemate() ? 'Stalemate' : 'Draw'}
              </span>
            </div>
          ) : multiPVLoading && !multiPV ? (
            <div style={{ padding: '0 0 4px' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton-pulse"
                  style={{ margin: '4px 12px', height: 28, animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          ) : displayLines ? (
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
                    onMouseEnter={e => { if (!isRowActive) e.currentTarget.style.background = 'var(--bg-surface)'; }}
                    onMouseLeave={e => { if (!isRowActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Rank */}
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 14, flexShrink: 0, paddingTop: 1 }}>
                      {line.rank}
                    </span>

                    {/* Score */}
                    <span style={{ fontFamily: '"Roboto Mono", monospace', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', width: 44, flexShrink: 0 }}>
                      {formatEvalLabel(line.score)}
                    </span>

                    {/* Move + continuation + English description */}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontFamily: '"Roboto Mono", monospace', fontSize: 13, fontWeight: 700, color: 'var(--text-accent)', marginRight: 6 }}>
                        {line.bestMoveSan}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'middle', maxWidth: '100%' }}>
                        {line.continuation}
                      </span>
                      <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: 'var(--text-secondary)', marginTop: 1 }}>
                        {line.english}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* ── Opening name ─────────────────────────────────────────────── */}
        {openingName && (
          <div className="shrink-0 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {openingName}
            </span>
          </div>
        )}

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
                        onClick={() => !botThinking && setCursor(wi + 1)}
                        aria-label={`Move ${pairIdx + 1} white: ${white.san}`}
                        aria-current={wActive ? 'true' : undefined}
                        className="move-btn"
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center',
                          padding: '4px 8px',
                          fontFamily: '"Roboto Mono", monospace',
                          fontSize: 14, lineHeight: 1.4,
                          color: wActive ? 'var(--text-accent)' : 'var(--text-primary)',
                          textAlign: 'left', cursor: botThinking ? 'default' : 'pointer',
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
                        onClick={() => !botThinking && setCursor(bi + 1)}
                        aria-label={`Move ${pairIdx + 1} black: ${black.san}`}
                        aria-current={bActive ? 'true' : undefined}
                        className="move-btn"
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center',
                          padding: '4px 8px',
                          fontFamily: '"Roboto Mono", monospace',
                          fontSize: 14, lineHeight: 1.4,
                          color: bActive ? 'var(--text-accent)' : 'var(--text-primary)',
                          textAlign: 'left', cursor: botThinking ? 'default' : 'pointer',
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
