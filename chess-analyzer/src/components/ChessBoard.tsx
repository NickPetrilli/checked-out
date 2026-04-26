import { Chessboard } from 'react-chessboard';
import type { Arrow, PieceDropHandlerArgs } from 'react-chessboard';

interface ChessBoardProps {
  fen?: string;
  onMove?: (from: string, to: string) => boolean;
  bestMoveArrow?: { from: string; to: string } | null;
  darkSquareStyle?: React.CSSProperties;
  lightSquareStyle?: React.CSSProperties;
}

export default function ChessBoard({ fen, onMove, bestMoveArrow, darkSquareStyle, lightSquareStyle }: ChessBoardProps) {
  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare || !onMove) return false;
    return onMove(sourceSquare, targetSquare);
  }

  const arrows: Arrow[] = bestMoveArrow
    ? [{ startSquare: bestMoveArrow.from, endSquare: bestMoveArrow.to, color: 'rgba(0, 200, 100, 0.8)' }]
    : [];

  return (
    <div className="w-full">
      <Chessboard
        options={{
          position: fen ?? 'start',
          onPieceDrop: onMove ? handleDrop : undefined,
          arrows,
          ...(darkSquareStyle  && { darkSquareStyle }),
          ...(lightSquareStyle && { lightSquareStyle }),
        }}
      />
    </div>
  );
}
