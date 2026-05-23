import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Link } from 'react-router-dom';
import { GraduationCap, Palette } from 'lucide-react';
import ChessBoard from '../components/ChessBoard';
import GameList from '../components/GameList';
import { useChessGamesContext } from '../context/ChessGamesContext';
import { evaluatePosition, ensureEngineReady } from '../services/stockfish';
import { explainMove } from '../services/aiExplainer';
import { evalBarWhitePct, formatEvalLabel, EvalBar } from '../utils/evalBar';
import { BOARD_THEMES, loadSavedTheme } from '../utils/boardThemes';
import type { BoardTheme } from '../utils/boardThemes';
import { PIECE_SETS, loadSavedPieceSet, getKingThumbnail } from '../utils/pieceSets';
import type { ParsedGame } from '../types/chess';

// ── Types ────────────────────────────────────────────────────────────────────

interface Ply {
  san: string;
  from: string;
  to: string;
  color: 'w' | 'b';
  moveNumber: number;
  fenBefore: string;
  fenAfter: string;
}

interface PlyEval {
  normalizedScore: number;
  bestMove: string;
  pvSan: string[];
}

type Classification = 'blunder' | 'mistake' | 'inaccuracy';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEPTH                = 15;
const BLUNDER_THRESHOLD    = 300;
const MISTAKE_THRESHOLD    = 100;
const INACCURACY_THRESHOLD = 50;
const RIGHT_WIDTH          = 340;
const EXPLANATION_ERROR    = '__error__';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatScore(score: number): string {
  if (score >= 9_900)  return `M${10_000 - score}`;
  if (score <= -9_900) return `-M${10_000 + score}`;
  const s = (score / 100).toFixed(2);
  return score > 0 ? `+${s}` : s;
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
  if (drop >= BLUNDER_THRESHOLD)    return { classification: 'blunder',    scoreDrop: drop };
  if (drop >= MISTAKE_THRESHOLD)    return { classification: 'mistake',    scoreDrop: drop };
  if (drop >= INACCURACY_THRESHOLD) return { classification: 'inaccuracy', scoreDrop: drop };
  return { scoreDrop: Math.max(0, drop) };
}

function parsePlies(pgn: string): { plies: Ply[]; fens: string[]; opening: string | null } {
  const tmp = new Chess();
  tmp.loadPgn(pgn);
  const history  = tmp.history({ verbose: true });
  const headers  = tmp.header();
  const setupFen = headers['FEN'];
  const opening  = headers['Opening'] ?? null;

  const chess = new Chess();
  if (setupFen) chess.load(setupFen);

  const fens: string[] = [chess.fen()];
  const plies: Ply[]   = [];

  for (const move of history) {
    const fenBefore = chess.fen();
    chess.move(move);
    plies.push({
      san: move.san,
      from: move.from,
      to: move.to,
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
  return { plies, fens, opening };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const CLASS_META: Record<Classification, { symbol: string; color: string; label: string }> = {
  blunder:    { symbol: '??', color: 'var(--move-blunder)',    label: 'Blunder' },
  mistake:    { symbol: '?',  color: 'var(--move-mistake)',    label: 'Mistake' },
  inaccuracy: { symbol: '?!', color: 'var(--move-inaccuracy)', label: 'Inaccuracy' },
};

function ClassBadge({ c }: { c?: Classification }) {
  if (!c) return null;
  const { symbol, color, label } = CLASS_META[c];
  return (
    <span
      aria-hidden="true"
      title={label}
      style={{
        color,
        fontWeight: 700,
        fontSize: 11,
        lineHeight: 1,
        flexShrink: 0,
        letterSpacing: '-0.5px',
        fontFamily: '"Roboto Mono", monospace',
      }}
    >
      {symbol}
    </span>
  );
}

// ── Player nameplate ─────────────────────────────────────────────────────────

interface NameplateProps {
  name:   string;
  rating: number;
  color:  'white' | 'black';
  isUser: boolean;
}

function PlayerNameplate({ name, rating, color, isUser }: NameplateProps) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 w-full">
      {/* Avatar circle */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
        style={{
          backgroundColor: color === 'white' ? 'rgba(240,217,181,0.12)' : 'rgba(30,28,25,0.85)',
          border: `1px solid ${color === 'white' ? 'rgba(240,217,181,0.22)' : 'rgba(255,255,255,0.07)'}`,
          color: 'var(--text-secondary)',
        }}
        aria-hidden="true"
      >
        {name.charAt(0).toUpperCase()}
      </div>

      {/* Name + rating */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="font-semibold text-sm truncate"
          style={{ color: isUser ? 'var(--text-accent)' : 'var(--text-primary)' }}
        >
          {name}
        </span>
        <span className="text-xs tabular-nums shrink-0" style={{ color: 'var(--text-secondary)' }}>
          ({rating})
        </span>
        {isUser && (
          <span
            className="px-1.5 py-0.5 rounded text-xs font-bold shrink-0"
            style={{ backgroundColor: 'var(--brand-green)', color: '#fff' }}
          >
            You
          </span>
        )}
      </div>
    </div>
  );
}

// ── Move table ────────────────────────────────────────────────────────────────

interface MoveTableProps {
  plies:             Ply[];
  evals:             (PlyEval | null)[];
  currentPly:        number;
  onJump:            (idx: number) => void;
  openingName:       string | null;
  explanations:      Record<number, string>;
  loadingExplainPly: number | null;
  onExplain:         (plyIdx: number) => void;
}

function MoveTable({
  plies, evals, currentPly, onJump,
  openingName, explanations, loadingExplainPly, onExplain,
}: MoveTableProps) {
  const activeRef   = useRef<HTMLButtonElement>(null);
  const isExplaining = loadingExplainPly !== null;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [currentPly]);

  const pairs: [Ply, number, Ply | undefined, number][] = [];
  for (let i = 0; i < plies.length; i += 2) {
    pairs.push([plies[i], i, plies[i + 1], i + 1]);
  }

  // Shared inline style for a move button — layout + typography only.
  // Active/hover backgrounds and the green left-border are handled by the
  // .move-btn CSS class in index.css to avoid inline-style specificity clashes.
  function moveBtnStyle(active: boolean): React.CSSProperties {
    return {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 8px',
      fontFamily: '"Roboto Mono", monospace',
      fontSize: 14,
      lineHeight: 1.4,
      color: active ? 'var(--text-accent)' : 'var(--text-primary)',
      textAlign: 'left',
      cursor: 'pointer',
      minWidth: 0,
      outline: 'none',
    };
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* Opening name — italic, secondary color, 12px */}
      {openingName && (
        <div
          className="shrink-0 px-3 py-2"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span
            style={{
              fontSize: 12,
              fontStyle: 'italic',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
            }}
          >
            {openingName}
          </span>
        </div>
      )}

      {/* Move rows */}
      <ol aria-label="Move list" className="move-list overflow-y-auto flex-1 min-h-0 list-none m-0 p-0">
        {pairs.map(([white, wi, black, bi]) => {
          const wClass  = classifyPly(evals, wi, 'w');
          const bClass  = black ? classifyPly(evals, bi, 'b') : undefined;
          const wActive = currentPly === wi + 1;
          const bActive = currentPly === bi + 1;

          return (
            <li
              key={wi}
              className="flex items-stretch"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
            >
              {/* Move number */}
              <span
                aria-hidden="true"
                className="flex items-center shrink-0 select-none tabular-nums"
                style={{
                  width: 32,
                  paddingLeft: 8,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                }}
              >
                {white.moveNumber}.
              </span>

              {/* ── White half ── */}
              <div className="flex items-center flex-1 min-w-0">
                <button
                  ref={wActive ? activeRef : undefined}
                  onClick={() => onJump(wi + 1)}
                  aria-label={`Move ${white.moveNumber} white: ${white.san}${wClass.classification ? `, ${wClass.classification}` : ''}`}
                  aria-current={wActive ? 'true' : undefined}
                  className="move-btn"
                  style={moveBtnStyle(wActive)}
                >
                  {wClass.classification && <ClassBadge c={wClass.classification} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {white.san}
                  </span>
                </button>

                {/* Ask Coach — white classified moves only */}
                {wClass.classification && (
                  loadingExplainPly === wi ? (
                    <span
                      className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin shrink-0 mr-1"
                      aria-label="Coach thinking…"
                    />
                  ) : (
                    <button
                      onClick={() => onExplain(wi)}
                      disabled={isExplaining}
                      aria-label={`Ask AI coach to explain this ${wClass.classification}`}
                      title="Ask AI coach"
                      className="shrink-0 p-1 rounded transition-colors disabled:opacity-30"
                      style={{
                        color: explanations[wi] !== undefined
                          ? 'var(--move-inaccuracy)'
                          : 'var(--text-secondary)',
                        opacity: isExplaining && loadingExplainPly !== wi ? 0.4 : 1,
                      }}
                    >
                      <GraduationCap className="w-3 h-3" />
                    </button>
                  )
                )}
              </div>

              {/* ── Black half ── */}
              <div className="flex items-center flex-1 min-w-0">
                {black ? (
                  <>
                    <button
                      ref={bActive ? activeRef : undefined}
                      onClick={() => onJump(bi + 1)}
                      aria-label={`Move ${black.moveNumber} black: ${black.san}${bClass?.classification ? `, ${bClass.classification}` : ''}`}
                      aria-current={bActive ? 'true' : undefined}
                      className="move-btn"
                      style={moveBtnStyle(bActive)}
                    >
                      {bClass?.classification && <ClassBadge c={bClass.classification} />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {black.san}
                      </span>
                    </button>

                    {/* Ask Coach — black classified moves only */}
                    {bClass?.classification && (
                      loadingExplainPly === bi ? (
                        <span
                          className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin shrink-0 mr-1"
                          aria-label="Coach thinking…"
                        />
                      ) : (
                        <button
                          onClick={() => onExplain(bi)}
                          disabled={isExplaining}
                          aria-label={`Ask AI coach to explain this ${bClass.classification}`}
                          title="Ask AI coach"
                          className="shrink-0 p-1 rounded transition-colors disabled:opacity-30"
                          style={{
                            color: explanations[bi] !== undefined
                              ? 'var(--move-inaccuracy)'
                              : 'var(--text-secondary)',
                            opacity: isExplaining && loadingExplainPly !== bi ? 0.4 : 1,
                          }}
                        >
                          <GraduationCap className="w-3 h-3" />
                        </button>
                      )
                    )}
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Accuracy panel ────────────────────────────────────────────────────────────

// Maps centipawn loss to per-move accuracy % (Lichess formula).
function movePctAccuracy(cpLoss: number): number {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * Math.max(0, cpLoss)) - 3.1668));
}

function accuracyColor(acc: number): string {
  if (acc >= 85) return 'var(--brand-green)';
  if (acc >= 70) return 'var(--move-inaccuracy)';
  return 'var(--move-blunder)';
}

interface PlayerSummary {
  accuracy:    number | null;
  best:        number;
  inaccuracies: number;
  mistakes:    number;
  blunders:    number;
}

function buildPlayerSummary(
  color: 'w' | 'b',
  plies: Ply[],
  evals: (PlyEval | null)[],
): PlayerSummary {
  let best = 0, inaccuracies = 0, mistakes = 0, blunders = 0;
  const accuracies: number[] = [];

  for (let i = 0; i < plies.length; i++) {
    if (plies[i].color !== color) continue;
    const { classification, scoreDrop } = classifyPly(evals, i, color);
    if      (classification === 'blunder')    blunders++;
    else if (classification === 'mistake')    mistakes++;
    else if (classification === 'inaccuracy') inaccuracies++;
    else                                      best++;
    if (evals[i] !== null && evals[i + 1] !== null) {
      accuracies.push(movePctAccuracy(Math.max(0, scoreDrop)));
    }
  }

  const accuracy = accuracies.length > 0
    ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length
    : null;

  return { accuracy, best, inaccuracies, mistakes, blunders };
}

// Radial SVG ring showing accuracy percentage
function AccuracyRing({ accuracy }: { accuracy: number | null }) {
  const SIZE  = 48;
  const R     = 19;
  const CIRC  = 2 * Math.PI * R;
  const color = accuracy !== null ? accuracyColor(accuracy) : 'var(--bg-surface)';
  const dash  = accuracy !== null ? CIRC * (accuracy / 100) : 0;

  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ transform: 'rotate(-90deg)', display: 'block' }}
        aria-hidden="true"
      >
        {/* Track */}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--bg-surface)" strokeWidth={4} />
        {/* Progress arc */}
        {accuracy !== null && (
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke={color}
            strokeWidth={4}
            strokeDasharray={`${dash} ${CIRC - dash}`}
            strokeLinecap="round"
          />
        )}
      </svg>
      {/* Centered label */}
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 0,
        }}
      >
        {accuracy !== null ? (
          <>
            <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1, color }}>
              {accuracy.toFixed(1)}
            </span>
            <span style={{ fontSize: 8, color: 'var(--text-secondary)', lineHeight: 1.2 }}>%</span>
          </>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>—</span>
        )}
      </div>
    </div>
  );
}

const PILL_META = [
  { key: 'best'        as const, symbol: '✓',  label: 'Best',       color: 'var(--move-best)',       bg: 'rgba(106,170,100,0.22)' },
  { key: 'inaccuracies'as const, symbol: '?!', label: 'Inaccuracy', color: 'var(--move-inaccuracy)', bg: 'rgba(246,198,64,0.22)'  },
  { key: 'mistakes'    as const, symbol: '?',  label: 'Mistake',    color: 'var(--move-mistake)',    bg: 'rgba(229,140,42,0.22)'  },
  { key: 'blunders'    as const, symbol: '??', label: 'Blunder',    color: 'var(--move-blunder)',    bg: 'rgba(204,50,50,0.22)'   },
];

function PlayerAccuracyRow({
  name, rating, isUser, summary,
}: {
  name: string; rating: number; isUser: boolean; summary: PlayerSummary;
}) {
  const counts = {
    best:         summary.best,
    inaccuracies: summary.inaccuracies,
    mistakes:     summary.mistakes,
    blunders:     summary.blunders,
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Avatar + name + ring */}
      <div className="flex items-center gap-2.5">
        <div
          aria-hidden="true"
          style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="truncate"
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}
            >
              {name}
            </span>
            {isUser && (
              <span
                style={{
                  fontSize: 9, fontWeight: 700, flexShrink: 0,
                  backgroundColor: 'var(--brand-green)', color: '#fff',
                  borderRadius: 3, padding: '1px 4px',
                }}
              >
                You
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{rating}</span>
        </div>

        <AccuracyRing accuracy={summary.accuracy} />
      </div>

      {/* Classification pills — only non-zero counts */}
      <div className="flex flex-wrap gap-1" style={{ paddingLeft: 42 }}>
        {PILL_META.map(({ key, symbol, label, color, bg }) => {
          const count = counts[key];
          if (count === 0) return null;
          return (
            <span
              key={key}
              title={label}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 6px', borderRadius: 12,
                backgroundColor: bg,
                fontSize: 11, fontWeight: 600, lineHeight: 1.4,
                fontFamily: '"Roboto Mono", monospace',
                color,
              }}
            >
              {count} {symbol}
            </span>
          );
        })}
      </div>
    </div>
  );
}

interface AccuracyPanelProps {
  plies:    Ply[];
  evals:    (PlyEval | null)[];
  white:    { name: string; rating: number };
  black:    { name: string; rating: number };
  username: string;
}

function AccuracyPanel({ plies, evals, white, black, username }: AccuracyPanelProps) {
  const whiteSummary = useMemo(() => buildPlayerSummary('w', plies, evals), [plies, evals]);
  const blackSummary = useMemo(() => buildPlayerSummary('b', plies, evals), [plies, evals]);

  return (
    <section
      aria-label="Game accuracy summary"
      className="shrink-0"
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex flex-col gap-3">
        <PlayerAccuracyRow
          name={white.name}
          rating={white.rating}
          isUser={username.toLowerCase() === white.name.toLowerCase()}
          summary={whiteSummary}
        />
        <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <PlayerAccuracyRow
          name={black.name}
          rating={black.rating}
          isUser={username.toLowerCase() === black.name.toLowerCase()}
          summary={blackSummary}
        />
      </div>
    </section>
  );
}

// ── Eval graph ───────────────────────────────────────────────────────────────

const GVW  = 1000;  // SVG viewBox width  (unitless, scales to container)
const GVH  = 80;    // SVG viewBox height (plot area)
const ZERO_Y = GVH / 2;
const PAD_T  = 3;   // top padding so the +10 line isn't flush with the edge

function gScoreToY(score: number): number {
  const s = Math.max(-1000, Math.min(1000, score));
  return ZERO_Y - (s / 1000) * (ZERO_Y - PAD_T);
}

interface EvalGraphProps {
  evals:      (PlyEval | null)[];
  plies:      Ply[];
  currentPly: number;
  onJump:     (ply: number) => void;
}

function EvalGraph({ evals, plies, currentPly, onJump }: EvalGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverPly, setHoverPly] = useState<number | null>(null);

  const n            = evals.length;
  const lastAnalyzed = evals.reduce<number>((acc, e, i) => (e !== null ? i : acc), -1);

  // Need at least 2 points to draw anything meaningful
  if (n < 2 || lastAnalyzed < 1) return null;

  const plyToX = (i: number): number => (i / (n - 1)) * GVW;

  // Build SVG paths through analyzed positions only.
  // Null evals (rare engine failures mid-game) produce a gap in the line.
  let lineD = '';
  let areaD = '';
  for (let i = 0; i <= lastAnalyzed; i++) {
    const e = evals[i];
    const x = plyToX(i);
    const y = e !== null ? gScoreToY(e.normalizedScore) : ZERO_Y;
    if (i === 0) {
      lineD = `M ${x},${y}`;
      areaD = `M ${x},${ZERO_Y} L ${x},${y}`;
    } else {
      lineD += ` L ${x},${y}`;
      areaD += ` L ${x},${y}`;
    }
  }
  areaD += ` L ${plyToX(lastAnalyzed)},${ZERO_Y} Z`;

  // Blunder / mistake dots on the graph line
  const markers: { x: number; y: number; color: string; key: number }[] = [];
  for (let i = 0; i < plies.length && i < lastAnalyzed; i++) {
    const e = evals[i + 1];
    if (!e) continue;
    const { classification } = classifyPly(evals, i, plies[i].color);
    if (!classification || classification === 'inaccuracy') continue;
    markers.push({
      x: plyToX(i + 1),
      y: gScoreToY(e.normalizedScore),
      color: CLASS_META[classification].color,
      key: i,
    });
  }

  // X-axis labels: every 10 plies = every 5 full moves
  const xLabels: { pct: number; text: string }[] = [];
  for (let ply = 10; ply < n; ply += 10) {
    xLabels.push({ pct: ply / (n - 1), text: String(Math.round(ply / 2)) });
  }

  function getPlyFromEvent(e: React.MouseEvent): number {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return Math.round(pct * (n - 1));
  }

  // Clamp hover ply to analyzed range so tooltip only appears over known data
  const clampedHover = hoverPly !== null ? Math.min(hoverPly, lastAnalyzed) : null;
  const hoverEval    = clampedHover !== null ? evals[clampedHover] : null;
  const hoverSan     = clampedHover !== null && clampedHover > 0 ? plies[clampedHover - 1] : null;

  const curY = evals[currentPly] !== null ? gScoreToY(evals[currentPly]!.normalizedScore) : ZERO_Y;
  const curX = plyToX(currentPly);

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 6,
        backgroundColor: 'var(--bg-secondary)',
        overflow: 'hidden',
        marginTop: 8,
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${GVW} ${GVH}`}
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: 78, cursor: 'crosshair' }}
        onMouseMove={e => setHoverPly(getPlyFromEvent(e))}
        onMouseLeave={() => setHoverPly(null)}
        onClick={e => onJump(getPlyFromEvent(e))}
        aria-label="Evaluation graph"
        role="img"
      >
        <defs>
          <clipPath id="ecg-upper">
            <rect x={0} y={0} width={GVW} height={ZERO_Y} />
          </clipPath>
          <clipPath id="ecg-lower">
            <rect x={0} y={ZERO_Y} width={GVW} height={GVH - ZERO_Y} />
          </clipPath>
        </defs>

        {/* Two-tone area fill: white = white advantage, dark = black advantage */}
        <path d={areaD} fill="rgba(255,255,255,0.15)" clipPath="url(#ecg-upper)" />
        <path d={areaD} fill="rgba(0,0,0,0.4)"        clipPath="url(#ecg-lower)" />

        {/* Dashed zero line */}
        <line
          x1={0} y1={ZERO_Y} x2={GVW} y2={ZERO_Y}
          stroke="rgba(255,255,255,0.18)" strokeWidth={0.8} strokeDasharray="3,3"
        />

        {/* Eval line */}
        <path d={lineD} fill="none" stroke="#b0aca6" strokeWidth={1.5} />

        {/* Hover vertical indicator */}
        {clampedHover !== null && (
          <line
            x1={plyToX(clampedHover)} y1={0} x2={plyToX(clampedHover)} y2={GVH}
            stroke="rgba(255,255,255,0.25)" strokeWidth={1}
          />
        )}

        {/* Classification markers */}
        {markers.map(m => (
          <circle key={m.key} cx={m.x} cy={m.y} r={3.5} fill={m.color} />
        ))}

        {/* Current ply: vertical line + dot */}
        <line
          x1={curX} y1={0} x2={curX} y2={GVH}
          stroke="rgba(255,255,255,0.45)" strokeWidth={1}
        />
        <circle cx={curX} cy={curY} r={3} fill="white" />
      </svg>

      {/* X-axis labels rendered as HTML so they aren't distorted by preserveAspectRatio="none" */}
      <div
        style={{
          position: 'relative',
          height: 14,
          fontSize: 10,
          color: 'var(--text-secondary)',
          opacity: 0.6,
        }}
      >
        {xLabels.map(({ pct, text }) => (
          <span
            key={text}
            style={{
              position: 'absolute',
              left: `${pct * 100}%`,
              transform: 'translateX(-50%)',
              lineHeight: '14px',
            }}
          >
            {text}
          </span>
        ))}
      </div>

      {/* Hover tooltip */}
      {clampedHover !== null && hoverEval !== null && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 4,
            left: `clamp(4px, calc(${(clampedHover / (n - 1)) * 100}% - 52px), calc(100% - 108px))`,
            pointerEvents: 'none',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            padding: '2px 7px',
            zIndex: 20,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-primary)',
              fontFamily: '"Roboto Mono", monospace',
            }}
          >
            {hoverSan
              ? `${hoverSan.moveNumber}${hoverSan.color === 'b' ? '…' : '.'} ${hoverSan.san} `
              : 'Start '}
            <span style={{ color: 'var(--text-secondary)' }}>
              {formatEvalLabel(hoverEval.normalizedScore)}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

// ── Move feedback bubble ─────────────────────────────────────────────────────

const FEEDBACK_TEXT: Record<Classification, string> = {
  blunder:    'A serious mistake that significantly weakens the position.',
  mistake:    'An imprecise move — a better option was available.',
  inaccuracy: 'A slightly inaccurate choice.',
};

function MoveFeedback({
  classification,
  onBestMove,
  hasBestMove,
}: {
  classification: Classification;
  onBestMove:     () => void;
  hasBestMove:    boolean;
}) {
  const { symbol, color, label } = CLASS_META[classification];
  return (
    <div
      className="shrink-0"
      style={{
        margin: '0 12px 8px',
        padding: '10px 12px',
        borderRadius: 6,
        backgroundColor: 'var(--bg-tertiary)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span style={{ fontFamily: '"Roboto Mono", monospace', fontWeight: 700, fontSize: 12, color }}>
          {symbol}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
        {FEEDBACK_TEXT[classification]}
      </p>
      <div className="flex gap-2">
        <button
          className="btn-primary"
          style={{ fontSize: 11, padding: '4px 10px', opacity: hasBestMove ? 1 : 0.4 }}
          onClick={onBestMove}
          disabled={!hasBestMove}
        >
          Best Move
        </button>
      </div>
    </div>
  );
}

// ── Engine lines ─────────────────────────────────────────────────────────────

interface EngineLinesProps {
  plyEval:    PlyEval | null;
  isAnalyzed: boolean;
  expanded:   boolean;
  onToggle:   () => void;
}

function EngineLines({ plyEval, isAnalyzed, expanded, onToggle }: EngineLinesProps) {
  const score        = plyEval?.normalizedScore;
  const pvSan        = plyEval?.pvSan ?? [];
  const bestMove     = pvSan[0] ?? null;
  const continuation = pvSan.slice(1, 6);

  const scoreColor =
    score === undefined  ? 'var(--text-secondary)'
    : score > 50  ? 'var(--move-best)'
    : score < -50 ? 'var(--move-blunder)'
    : 'var(--text-secondary)';

  return (
    <div
      className="shrink-0"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
          }}
        >
          Engine
        </span>
        <button
          onClick={onToggle}
          aria-label={expanded ? 'Collapse engine lines' : 'Expand engine lines'}
          aria-expanded={expanded}
          className="text-xs transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3">
          {!isAnalyzed || !plyEval ? (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', opacity: 0.5 }}>
              {isAnalyzed ? 'No engine data.' : 'Analyzing…'}
            </p>
          ) : (
            <>
              <div className="flex items-baseline gap-2.5">
                {/* Eval score */}
                <span
                  className="shrink-0 tabular-nums"
                  style={{
                    fontFamily: '"Roboto Mono", monospace',
                    fontSize: 13,
                    fontWeight: 700,
                    color: scoreColor,
                    minWidth: 44,
                  }}
                >
                  {score !== undefined ? formatEvalLabel(score) : '—'}
                </span>

                {/* PV: bold best move + muted continuation */}
                <div
                  style={{
                    fontFamily: '"Roboto Mono", monospace',
                    fontSize: 12,
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  {bestMove ? (
                    <>
                      <span style={{ fontWeight: 700, color: 'var(--text-accent)' }}>
                        {bestMove}
                      </span>
                      {continuation.length > 0 && (
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {' '}{continuation.join(' ')}
                        </span>
                      )}
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>—</span>
                  )}
                </div>
              </div>

              {/* Footer: depth + engine name */}
              <p style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.4, marginTop: 6 }}>
                Depth: {DEPTH} · Stockfish 18
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ engineError }: { engineError: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
      <p className="text-4xl" aria-hidden="true">♟</p>
      <p className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>No games loaded</p>
      <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>
        Fetch your Chess.com games on the Home page first, then come back here to analyse them.
      </p>
      <Link to="/" className="btn-primary text-sm">
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

  const [plies,                setPlies]                = useState<Ply[]>([]);
  const [fens,                 setFens]                 = useState<string[]>([]);
  const [evals,                setEvals]                = useState<(PlyEval | null)[]>([]);
  const [currentPly,           setCurrentPly]           = useState(0);
  const [isAnalyzing,          setIsAnalyzing]          = useState(false);
  const [analysisDone,         setAnalysisDone]         = useState(0);
  const [analysisTotal,        setAnalysisTotal]        = useState(0);
  const [engineError,          setEngineError]          = useState<string | null>(null);
  const [leftOpen,             setLeftOpen]             = useState(true);
  const [flipped,              setFlipped]              = useState(false);
  const [opening,              setOpening]              = useState<string | null>(null);
  const [boardTheme,           setBoardTheme]           = useState<BoardTheme>(loadSavedTheme);
  const [themePickerOpen,      setThemePickerOpen]      = useState(false);
  const [pieceSet,             setPieceSetState]        = useState(loadSavedPieceSet);
  const [piecePickerOpen,      setPiecePickerOpen]      = useState(false);
  const [explanations,         setExplanations]         = useState<Record<number, string>>({});
  const [loadingExplainPly,    setLoadingExplainPly]    = useState<number | null>(null);
  const [activeExplanationPly, setActiveExplanationPly] = useState<number | null>(null);
  const [showEngineLines,      setShowEngineLines]      = useState(true);
  const [showBestMoveFor,      setShowBestMoveFor]      = useState<number | null>(null);
  const [rightTab,             setRightTab]             = useState<'review' | 'analysis' | 'explore'>('review');

  const cancelRef       = useRef(0);
  const themePickerRef  = useRef<HTMLDivElement>(null);
  const piecePickerRef  = useRef<HTMLDivElement>(null);

  // Pre-warm engine
  useEffect(() => {
    ensureEngineReady().catch((err: unknown) => {
      setEngineError(err instanceof Error ? err.message : 'Failed to load chess engine.');
    });
  }, []);

  // Close theme picker on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setThemePickerOpen(false);
      }
      if (piecePickerRef.current && !piecePickerRef.current.contains(e.target as Node)) {
        setPiecePickerOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const selectPieceSet = useCallback((id: string) => {
    const found = PIECE_SETS.find(s => s.id === id);
    if (!found) return;
    localStorage.setItem('chess-piece-set', id);
    setPieceSetState(found);
  }, []);

  // ── Game selection ──────────────────────────────────────────────────────────

  const handleSelectGame = useCallback(
    async (game: ParsedGame) => {
      if (engineError) return;
      selectGame(game);

      const token = ++cancelRef.current;
      const { plies: newPlies, fens: newFens, opening: newOpening } = parsePlies(game.pgn);

      setPlies(newPlies);
      setFens(newFens);
      setOpening(newOpening);
      setEvals(new Array(newFens.length).fill(null));
      setCurrentPly(0);
      setIsAnalyzing(true);
      setAnalysisDone(0);
      setAnalysisTotal(newFens.length);
      setExplanations({});
      setActiveExplanationPly(null);
      setLoadingExplainPly(null);

      const acc: (PlyEval | null)[] = new Array(newFens.length).fill(null);

      for (let i = 0; i < newFens.length; i++) {
        if (cancelRef.current !== token) return;
        try {
          const result = await evaluatePosition(newFens[i], DEPTH);
          if (cancelRef.current !== token) return;

          // Convert UCI pv moves to SAN for display
          const pvSan: string[] = [];
          try {
            const pvChess = new Chess();
            pvChess.load(newFens[i]);
            for (const uci of result.pv.slice(0, 7)) {
              const m = pvChess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? undefined });
              if (!m) break;
              pvSan.push(m.san);
            }
          } catch { /* leave pvSan empty */ }

          acc[i] = { normalizedScore: result.score, bestMove: result.bestMove, pvSan };
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

  // ── AI explanation ──────────────────────────────────────────────────────────

  const handleExplain = useCallback(
    async (plyIdx: number) => {
      // Serve from cache; skip error sentinel so user can retry after a failure
      if (explanations[plyIdx] !== undefined && explanations[plyIdx] !== EXPLANATION_ERROR) {
        setActiveExplanationPly(plyIdx);
        return;
      }

      setLoadingExplainPly(plyIdx);
      setActiveExplanationPly(plyIdx);

      const ply         = plies[plyIdx];
      const { classification } = classifyPly(evals, plyIdx, ply.color);
      const bestMoveUci = evals[plyIdx]?.bestMove ?? '';

      // Convert UCI best move to SAN for a more readable prompt
      let bestMoveSan = bestMoveUci;
      if (bestMoveUci.length >= 4) {
        try {
          const chess = new Chess();
          chess.load(ply.fenBefore);
          const m = chess.move({
            from: bestMoveUci.slice(0, 2),
            to:   bestMoveUci.slice(2, 4),
            promotion: bestMoveUci[4] ?? undefined,
          });
          if (m) bestMoveSan = m.san;
        } catch { /* leave as UCI */ }
      }

      try {
        const text = await explainMove({
          fen:            ply.fenBefore,
          movePlayed:     ply.san,
          bestMove:       bestMoveSan,
          classification: classification ?? 'inaccuracy',
          playerColor:    ply.color === 'w' ? 'white' : 'black',
          moveNumber:     ply.moveNumber,
        });
        setExplanations(prev => ({ ...prev, [plyIdx]: text }));
      } catch {
        setExplanations(prev => ({ ...prev, [plyIdx]: EXPLANATION_ERROR }));
      }

      setLoadingExplainPly(null);
    },
    [plies, evals, explanations],
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

  // Clear Coach Analysis panel whenever the user navigates to a different move
  useEffect(() => {
    setActiveExplanationPly(null);
  }, [currentPly]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const currentFen      = fens[currentPly] ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const currentEval     = evals[currentPly];
  const analysisComplete = !isAnalyzing && plies.length > 0;

  // Yellow highlight on the from/to squares of the last played move
  const lastMoveSquares = useMemo((): [string, string] | null => {
    if (currentPly === 0) return null;
    const ply = plies[currentPly - 1];
    return ply ? [ply.from, ply.to] : null;
  }, [currentPly, plies]);

  // Classification badge on the destination square of the last played move
  const classificationBadge = useMemo(() => {
    if (currentPly === 0) return null;
    const ply = plies[currentPly - 1];
    if (!ply) return null;
    const { classification } = classifyPly(evals, currentPly - 1, ply.color);
    if (!classification) return null;
    return { square: ply.to, classification };
  }, [currentPly, plies, evals]);

  // Show best-move arrow when explanation is active OR "Best Move" button was pressed.
  // Graduation cap (activeExplanationPly) navigates to the ply and requires an exact match.
  // Best Move button (showBestMoveFor) stays on the current position: show the arrow for
  // evals[N-1] while the board is at ply N (position after the bad move).
  const bestMoveArrow = useMemo(() => {
    if (activeExplanationPly !== null) {
      if (currentPly !== activeExplanationPly) return null;
      const uci = evals[activeExplanationPly]?.bestMove;
      if (!uci || uci.length < 4) return null;
      return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
    }
    if (showBestMoveFor !== null && currentPly === showBestMoveFor + 1) {
      const uci = evals[showBestMoveFor]?.bestMove;
      if (!uci || uci.length < 4) return null;
      return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
    }
    return null;
  }, [activeExplanationPly, showBestMoveFor, currentPly, evals]);

  if (games.length === 0) {
    return <EmptyState engineError={engineError} />;
  }

  // Board area max-width: never wider than the center column, never taller than
  // the viewport minus the nav bar (52px), nameplates (~80px), controls (~48px),
  // and padding (~40px).
  const boardAreaMaxWidth = 'min(100%, calc(100vh - 220px))';

  return (
    <div
      className="flex h-[calc(100vh-52px)] overflow-hidden"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >

      {/* ── Left: game list (collapsible) ───────────────────────────────── */}
      {leftOpen ? (
        <aside
          aria-label="Game list"
          className="shrink-0 flex flex-col p-3 overflow-hidden"
          style={{
            width: 288,
            backgroundColor: 'var(--bg-secondary)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Games
            </h2>
            <button
              onClick={() => setLeftOpen(false)}
              aria-label="Collapse game list"
              title="Collapse game list"
              className="p-1 rounded text-sm transition-colors"
              style={{ color: 'var(--text-secondary)' }}
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
        <div
          className="shrink-0 flex flex-col items-center pt-2"
          style={{
            width: 32,
            backgroundColor: 'var(--bg-secondary)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <button
            onClick={() => setLeftOpen(true)}
            aria-label="Expand game list"
            title="Expand game list"
            className="p-1 rounded text-xs transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            ▶
          </button>
        </div>
      )}

      {/* ── Center: board ───────────────────────────────────────────────── */}
      <main
        aria-label="Chess board and controls"
        className="flex flex-col items-center justify-start gap-2 p-4 overflow-y-auto flex-1 min-w-0"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {/* Everything in the center is constrained to a max-width so the board
            never overflows the available height */}
        <div className="flex flex-col w-full mx-auto" style={{ maxWidth: boardAreaMaxWidth }}>

          {/* Theme + Piece pickers — top-right of the board area */}
          <div className="flex justify-end mb-1 gap-1">

            {/* Piece set picker */}
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
                          backgroundColor: boardTheme.id === theme.id
                            ? 'var(--bg-surface)'
                            : 'transparent',
                        }}
                      >
                        <div className="grid grid-cols-2 w-8 h-8 rounded-sm overflow-hidden"
                          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
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

          {/* Top nameplate — opponent when white is at bottom, self when flipped */}
          {selectedGame && (
            <PlayerNameplate
              name={flipped ? selectedGame.white : selectedGame.black}
              rating={flipped ? selectedGame.whiteRating : selectedGame.blackRating}
              color={flipped ? 'white' : 'black'}
              isUser={username.toLowerCase() === (flipped ? selectedGame.white : selectedGame.black).toLowerCase()}
            />
          )}

          {/* Eval bar (vertical, 20px) + Board side by side */}
          <div className="flex items-stretch gap-1.5">
            <EvalBar score={currentEval?.normalizedScore} />
            <div className="flex-1">
              <ChessBoard
                fen={currentFen}
                bestMoveArrow={bestMoveArrow}
                darkSquareStyle={{ backgroundColor: boardTheme.dark }}
                lightSquareStyle={{ backgroundColor: boardTheme.light }}
                boardOrientation={flipped ? 'black' : 'white'}
                lastMoveSquares={lastMoveSquares}
                classificationBadge={classificationBadge}
                pieces={pieceSet.pieces}
              />
            </div>
          </div>

          {/* Bottom nameplate — self when white is at bottom, opponent when flipped */}
          {selectedGame && (
            <PlayerNameplate
              name={flipped ? selectedGame.black : selectedGame.white}
              rating={flipped ? selectedGame.blackRating : selectedGame.whiteRating}
              color={flipped ? 'black' : 'white'}
              isUser={username.toLowerCase() === (flipped ? selectedGame.black : selectedGame.white).toLowerCase()}
            />
          )}

          {/* Navigation controls */}
          <div
            role="group"
            aria-label="Move navigation"
            className="flex items-center justify-center gap-1 mt-1"
          >
            {/* Eval score — left of nav buttons */}
            <span
              className="text-xs tabular-nums font-mono mr-2"
              style={{ color: 'var(--text-secondary)', minWidth: 48, textAlign: 'right' }}
              aria-live="polite"
            >
              {currentEval ? formatScore(currentEval.normalizedScore) : ''}
            </span>

            {[
              { label: '⏮', ariaLabel: 'Go to start',     key: 'start', action: () => goTo(0),               disabled: currentPly === 0 },
              { label: '◀', ariaLabel: 'Previous move',   key: 'prev',  action: () => goTo(currentPly - 1),  disabled: currentPly === 0 },
              { label: '▶', ariaLabel: 'Next move',       key: 'next',  action: () => goTo(currentPly + 1),  disabled: currentPly >= fens.length - 1 },
              { label: '⏭', ariaLabel: 'Go to last move', key: 'end',   action: () => goTo(fens.length - 1), disabled: currentPly >= fens.length - 1 },
            ].map(({ label, ariaLabel, key, action, disabled }) => (
              <button
                key={key}
                onClick={action}
                aria-label={ariaLabel}
                disabled={plies.length === 0 || disabled}
                className="w-10 h-10 flex items-center justify-center text-base transition-colors disabled:opacity-30 focus:outline-none focus:ring-1 focus:ring-[var(--brand-green)] hover:bg-[var(--bg-tertiary)]"
                style={{ borderRadius: 4, color: 'var(--text-secondary)' }}
              >
                <span aria-hidden="true">{label}</span>
              </button>
            ))}

            {/* Move counter */}
            {plies.length > 0 && (
              <span
                className="text-xs ml-2 tabular-nums"
                style={{ color: 'var(--text-secondary)' }}
                aria-live="polite"
              >
                {currentPly}/{plies.length}
              </span>
            )}

            {/* Flip board */}
            <button
              onClick={() => setFlipped(f => !f)}
              aria-label={flipped ? 'Flip board to white' : 'Flip board to black'}
              title="Flip board"
              className="w-10 h-10 flex items-center justify-center text-base transition-colors hover:bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-green)] ml-2"
              style={{ borderRadius: 4, color: flipped ? 'var(--brand-green)' : 'var(--text-secondary)' }}
            >
              ↕
            </button>
          </div>

          {/* Evaluation graph */}
          {plies.length > 0 && (
            <EvalGraph
              evals={evals}
              plies={plies}
              currentPly={currentPly}
              onJump={goTo}
            />
          )}

          {/* Analysis progress bar */}
          {isAnalyzing && (
            <div role="status" aria-live="polite" className="mt-2">
              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                <span>Analyzing… {analysisDone}/{analysisTotal}</span>
              </div>
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--bg-surface)' }}
              >
                <div
                  className="h-full transition-all duration-200"
                  style={{
                    width: `${(analysisDone / analysisTotal) * 100}%`,
                    backgroundColor: 'var(--brand-green)',
                  }}
                />
              </div>
            </div>
          )}

          {!selectedGame && (
            <p className="text-sm mt-4 text-center" style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>
              Select a game from the list to begin analysis.
            </p>
          )}
        </div>
      </main>

      {/* ── Right: tabs + content (fixed width) ────────────────────────── */}
      {plies.length > 0 && (
        <aside
          aria-label="Move analysis panel"
          className="shrink-0 flex flex-col overflow-hidden"
          style={{
            width: RIGHT_WIDTH,
            backgroundColor: 'var(--bg-secondary)',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Tab bar */}
          <div
            className="flex shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            {([
              { key: 'review'   as const, label: 'Review'   },
              { key: 'analysis' as const, label: 'Analysis' },
              { key: 'explore'  as const, label: 'Explore'  },
            ]).map(({ key, label }) => {
              const active = rightTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setRightTab(key)}
                  style={{
                    fontSize: 13,
                    padding: '10px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: `2px solid ${active ? 'var(--brand-green)' : 'transparent'}`,
                    color: active ? 'var(--text-accent)' : 'var(--text-secondary)',
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                    marginBottom: -1,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tab content — key forces fade-in animation on switch */}
          <div key={rightTab} className="page-transition flex flex-col flex-1 min-h-0 overflow-hidden">

            {/* ── Review ── */}
            {rightTab === 'review' && (
              <>
                {analysisComplete && selectedGame && (
                  <AccuracyPanel
                    plies={plies}
                    evals={evals}
                    white={{ name: selectedGame.white, rating: selectedGame.whiteRating }}
                    black={{ name: selectedGame.black, rating: selectedGame.blackRating }}
                    username={username}
                  />
                )}

                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  <MoveTable
                    plies={plies}
                    evals={evals}
                    currentPly={currentPly}
                    onJump={goTo}
                    openingName={opening}
                    explanations={explanations}
                    loadingExplainPly={loadingExplainPly}
                    onExplain={handleExplain}
                  />

                  <EngineLines
                    plyEval={currentEval ?? null}
                    isAnalyzed={analysisComplete}
                    expanded={showEngineLines}
                    onToggle={() => setShowEngineLines(o => !o)}
                  />

                  {/* Move feedback — shown when a classified move is selected */}
                  {classificationBadge && analysisComplete && (
                    <MoveFeedback
                      classification={classificationBadge.classification}
                      hasBestMove={currentPly > 0 && !!evals[currentPly - 1]?.bestMove}
                      onBestMove={() => {
                        setActiveExplanationPly(null);
                        setShowBestMoveFor(currentPly - 1);
                      }}
                    />
                  )}

                  {/* Coach Analysis — shown when graduation cap triggers AI explanation */}
                  {activeExplanationPly !== null && (() => {
                    const isLoading = loadingExplainPly === activeExplanationPly
                      || explanations[activeExplanationPly] === undefined;
                    const isError   = explanations[activeExplanationPly] === EXPLANATION_ERROR;
                    const text      = !isLoading && !isError
                      ? explanations[activeExplanationPly]
                      : null;
                    return (
                      <div className="shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ padding: '10px 16px 2px' }}>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: '0.08em',
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase' as const,
                          }}>
                            Coach Analysis
                          </span>
                        </div>
                        <div style={{ padding: '6px 16px 12px' }}>
                          {isLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                className="w-3 h-3 border border-t-transparent rounded-full animate-spin shrink-0"
                                style={{ borderColor: 'var(--text-secondary)' }}
                              />
                              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Analyzing…</span>
                            </div>
                          ) : isError ? (
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                              Analysis unavailable. Try again.
                            </span>
                          ) : (
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                              {text}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <p className="text-xs mt-2 mb-2 px-3 shrink-0" style={{ color: 'var(--text-secondary)', opacity: 0.45 }}>
                    AI explanations use the Gemini free tier (250 req/day).
                  </p>
                </div>
              </>
            )}

            {/* ── Analysis ── */}
            {rightTab === 'analysis' && (
              <div className="flex flex-col flex-1 items-center justify-center p-6 text-center">
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', opacity: 0.5 }}>
                  Detailed analysis coming soon.
                </p>
              </div>
            )}

            {/* ── Explore ── */}
            {rightTab === 'explore' && (
              <div className="flex flex-col flex-1 items-center justify-center p-6 text-center">
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', opacity: 0.5 }}>
                  Opening explorer coming soon.
                </p>
              </div>
            )}

          </div>
        </aside>
      )}
    </div>
  );
}
