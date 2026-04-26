export interface ChessComPlayer {
  username: string;
  rating: number;
  result: string;
}

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  white: ChessComPlayer;
  black: ChessComPlayer;
}

export interface ChessComProfile {
  avatar?: string;
  username: string;
  country: string;
  last_online: number;
}

export interface ParsedGame {
  id: string;
  white: string;
  black: string;
  whiteRating: number;
  blackRating: number;
  date: string;
  pgn: string;
  timeControl: string;
  result: 'white' | 'black' | 'draw';
  gameType: 'online' | 'computer';
}

export interface GameMove {
  moveNumber: number;
  san: string;
  from: string;
  to: string;
  piece: string;
  color: 'w' | 'b';
  fenBefore: string;
  fenAfter: string;
  evaluation?: number;
  bestMove?: string;
  isMistake?: boolean;
  isBlunder?: boolean;
  explanation?: string;
  explanationLoading?: boolean;
  explanationError?: string | null;
}

export type Square =
  | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6' | 'a7' | 'a8'
  | 'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6' | 'b7' | 'b8'
  | 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'c7' | 'c8'
  | 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6' | 'd7' | 'd8'
  | 'e1' | 'e2' | 'e3' | 'e4' | 'e5' | 'e6' | 'e7' | 'e8'
  | 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8'
  | 'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'g6' | 'g7' | 'g8'
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'h7' | 'h8';

export type HeatmapData = Record<Square, number>;
