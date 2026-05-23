import type { PieceRenderObject } from 'react-chessboard';
import { defaultPieces } from 'react-chessboard';

export interface PieceSetDef {
  id: string;
  name: string;
  pieces: PieceRenderObject | null; // null = use react-chessboard default
}

const PIECE_CODES = [
  'wK','wQ','wR','wB','wN','wP',
  'bK','bQ','bR','bB','bN','bP',
] as const;

// Piece sets hosted by Lichess (open source, AGPL). Files are named
// consistently as {color}{Type}.svg (e.g. wK.svg, bP.svg).
function makeLichessPieces(theme: string): PieceRenderObject {
  return Object.fromEntries(
    PIECE_CODES.map(code => [
      code,
      (props?: { fill?: string; square?: string; svgStyle?: React.CSSProperties }) => (
        <img
          src={`https://lichess1.org/assets/piece/${theme}/${code}.svg`}
          style={{ width: '100%', height: '100%', objectFit: 'contain', ...props?.svgStyle }}
          alt=""
          draggable={false}
        />
      ),
    ])
  ) as PieceRenderObject;
}

export const PIECE_SETS: PieceSetDef[] = [
  { id: 'neo',      name: 'Neo',     pieces: null },
  { id: 'cburnett', name: 'Classic', pieces: makeLichessPieces('cburnett') },
  { id: 'alpha',    name: 'Alpha',   pieces: makeLichessPieces('alpha') },
  { id: 'merida',   name: 'Merida',  pieces: makeLichessPieces('merida') },
];

export function loadSavedPieceSet(): PieceSetDef {
  const saved = localStorage.getItem('chess-piece-set');
  return PIECE_SETS.find(s => s.id === saved) ?? PIECE_SETS[0];
}

// Returns the wK component for a given piece set — used for thumbnails.
export function getKingThumbnail(set: PieceSetDef): React.ReactNode {
  if (!set.pieces) {
    const WK = defaultPieces['wK'];
    return <WK />;
  }
  const WK = set.pieces['wK'];
  return <WK />;
}
