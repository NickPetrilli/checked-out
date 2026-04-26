import { Chessboard } from 'react-chessboard';
import type { PieceDropHandlerArgs } from 'react-chessboard';

interface ChessBoardProps {
  fen?: string;
  onMove?: (from: string, to: string) => boolean;
}

export default function ChessBoard({ fen, onMove }: ChessBoardProps) {
  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare || !onMove) return false;
    return onMove(sourceSquare, targetSquare);
  }

  return (
    <div className="w-full">
      <Chessboard
        options={{
          position: fen ?? 'start',
          onPieceDrop: onMove ? handleDrop : undefined,
        }}
      />
    </div>
  );
}
