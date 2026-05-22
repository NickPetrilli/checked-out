import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Arrow, PieceDropHandlerArgs, SquareRenderer } from 'react-chessboard';

// Badge metadata keyed by classification — mirrors the CSS variable values so
// the board component is self-contained (no DOM access needed here).
const BADGE: Record<string, { symbol: string; bg: string }> = {
  blunder: { symbol: '??', bg: '#cc3232' },
  mistake: { symbol: '?',  bg: '#e58c2a' },
};

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
}: ChessBoardProps) {
  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare || !onMove) return false;
    return onMove(sourceSquare, targetSquare);
  }

  const arrows: Arrow[] = bestMoveArrow
    ? [{ startSquare: bestMoveArrow.from, endSquare: bestMoveArrow.to, color: 'rgba(0, 128, 0, 0.8)' }]
    : [];

  // Yellow overlay on both squares of the last played move (Chess.com style)
  const squareStyles = useMemo((): Record<string, React.CSSProperties> => {
    if (!lastMoveSquares) return {};
    return {
      [lastMoveSquares[0]]: { backgroundColor: 'rgba(255, 255, 0, 0.5)' },
      [lastMoveSquares[1]]: { backgroundColor: 'rgba(255, 255, 0, 0.5)' },
    };
  }, [lastMoveSquares]);

  // Classification badge rendered inside the destination square.
  // squareRenderer is called for every square on every render; memoize so
  // the Chessboard doesn't see a new function reference on unrelated state changes.
  const squareRenderer: SquareRenderer = useMemo(
    () =>
      ({ square, children }) => {
        const badge =
          classificationBadge?.square === square
            ? BADGE[classificationBadge.classification]
            : null;

        return (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {children}
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
          </div>
        );
      },
    [classificationBadge],
  );

  return (
    <div className="w-full">
      <Chessboard
        options={{
          position: fen ?? 'start',
          boardOrientation,
          onPieceDrop: onMove ? handleDrop : undefined,
          arrows,
          squareStyles,
          squareRenderer,
          showNotation: true,
          // Notation contrast colors: each square type uses the inverse wood tone
          lightSquareNotationStyle: { color: 'rgba(107, 83, 55, 0.75)', fontSize: 10, fontWeight: 600 },
          darkSquareNotationStyle:  { color: 'rgba(240, 217, 181, 0.75)', fontSize: 10, fontWeight: 600 },
          animationDurationInMs: 150,
          ...(darkSquareStyle  && { darkSquareStyle }),
          ...(lightSquareStyle && { lightSquareStyle }),
        }}
      />
    </div>
  );
}
