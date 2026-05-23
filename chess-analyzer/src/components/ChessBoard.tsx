import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Arrow, PieceDropHandlerArgs, PieceHandlerArgs, PieceRenderObject, SquareRenderer } from 'react-chessboard';

// Badge metadata keyed by classification — mirrors the CSS variable values so
// the board component is self-contained (no DOM access needed here).
const BADGE: Record<string, { symbol: string; bg: string }> = {
  blunder: { symbol: '??', bg: '#cc3232' },
  mistake: { symbol: '?',  bg: '#e58c2a' },
};

// Dark square when (file_index + rank_index) is even: a1=dark, b1=light, etc.
function isDark(sq: string): boolean {
  return (sq.charCodeAt(0) - 97 + parseInt(sq[1]) - 1) % 2 === 0;
}

interface ChessBoardProps {
  fen?: string;
  onMove?: (from: string, to: string) => boolean;
  bestMoveArrow?: { from: string; to: string } | null;
  darkSquareStyle?: React.CSSProperties;
  lightSquareStyle?: React.CSSProperties;
  boardOrientation?: 'white' | 'black';
  /** Squares [from, to] of the last played move — rendered with a yellow overlay */
  lastMoveSquares?: [string, string] | null;
  /** Badge shown on the destination square of the current move when classified */
  classificationBadge?: { square: string; classification: 'blunder' | 'mistake' } | null;
  /** Square of the currently selected piece — rendered with a green overlay */
  selectedSquare?: string | null;
  /** Legal destination squares for the selected piece */
  legalMoveSquares?: { square: string; isCapture: boolean }[];
  /** Called when the user clicks a square (for click-to-move) */
  onSquareClick?: (square: string) => void;
  /** Called when the user starts dragging a piece (square it came from) */
  onDragBegin?: (square: string) => void;
  /** Called when a drag ends without completing a valid move */
  onDragEnd?: () => void;
  /** Custom piece renderers — null/undefined uses the react-chessboard default */
  pieces?: PieceRenderObject | null;
}

export default function ChessBoard({
  fen,
  onMove,
  bestMoveArrow,
  darkSquareStyle,
  lightSquareStyle,
  boardOrientation = 'white',
  lastMoveSquares,
  classificationBadge,
  selectedSquare,
  legalMoveSquares,
  onSquareClick,
  onDragBegin,
  onDragEnd,
  pieces,
}: ChessBoardProps) {
  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare || !onMove) {
      onDragEnd?.();
      return false;
    }
    const success = onMove(sourceSquare, targetSquare);
    if (!success) onDragEnd?.();
    return success;
  }

  function handlePieceDrag({ square }: PieceHandlerArgs) {
    if (square) onDragBegin?.(square);
  }

  const arrows: Arrow[] = bestMoveArrow
    ? [{ startSquare: bestMoveArrow.from, endSquare: bestMoveArrow.to, color: 'rgba(0, 128, 0, 0.8)' }]
    : [];

  // Only badges need squareStyles — highlights and selection are rendered inside squareRenderer
  // so they always appear above the board theme colors but beneath the piece.
  const squareStyles = useMemo((): Record<string, React.CSSProperties> => ({}), []);

  const squareRenderer: SquareRenderer = useMemo(
    () =>
      ({ square, children }) => {
        const badge = classificationBadge?.square === square
          ? BADGE[classificationBadge.classification]
          : null;
        const lm        = legalMoveSquares?.find(m => m.square === square) ?? null;
        const isLastMove = lastMoveSquares != null &&
          (lastMoveSquares[0] === square || lastMoveSquares[1] === square);
        const isSelected = selectedSquare === square;
        const dotColor   = isDark(square) ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)';

        return (
          <div
            style={{ position: 'relative', width: '100%', height: '100%' }}
            onClick={() => onSquareClick?.(square)}
          >
            {/* Last-move highlight — rendered before children so piece sits on top */}
            {isLastMove && !isSelected && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: isDark(square)
                    ? 'rgba(170, 162, 58, 0.45)'
                    : 'rgba(205, 210, 106, 0.45)',
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              />
            )}

            {/* Selected-piece highlight */}
            {isSelected && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(20, 85, 30, 0.5)',
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              />
            )}

            {children}

            {/* Classification badge (Analyzer) */}
            {badge && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  bottom: 3,
                  right: 3,
                  zIndex: 10,
                  borderRadius: 3,
                  backgroundColor: badge.bg,
                  padding: '1px 4px',
                  lineHeight: 1,
                  pointerEvents: 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                }}
              >
                <span style={{ fontSize: 10, color: '#fff', fontWeight: 800, letterSpacing: '-0.5px' }}>
                  {badge.symbol}
                </span>
              </div>
            )}

            {/* Legal move dot — empty destination square */}
            {lm && !lm.isCapture && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '33%',
                  height: '33%',
                  borderRadius: '50%',
                  backgroundColor: dotColor,
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              />
            )}

            {/* Legal move ring — capture destination square */}
            {lm?.isCapture && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: `8px solid ${dotColor}`,
                  pointerEvents: 'none',
                  boxSizing: 'border-box',
                  zIndex: 2,
                }}
              />
            )}
          </div>
        );
      },
    [classificationBadge, legalMoveSquares, onSquareClick, lastMoveSquares, selectedSquare],
  );

  return (
    <div className="w-full">
      <Chessboard
        options={{
          position: fen ?? 'start',
          boardOrientation,
          onPieceDrop: onMove ? handleDrop : undefined,
          onPieceDrag: onDragBegin ? handlePieceDrag : undefined,
          arrows,
          squareStyles,
          squareRenderer,
          showNotation: true,
          // Notation contrast colors: each square type uses the inverse wood tone
          lightSquareNotationStyle: { color: 'rgba(107, 83, 55, 0.75)', fontSize: 10, fontWeight: 600 },
          darkSquareNotationStyle:  { color: 'rgba(240, 217, 181, 0.75)', fontSize: 10, fontWeight: 600 },
          animationDurationInMs: 150,
          ...(pieces           && { pieces }),
          ...(darkSquareStyle  && { darkSquareStyle }),
          ...(lightSquareStyle && { lightSquareStyle }),
        }}
      />
    </div>
  );
}
