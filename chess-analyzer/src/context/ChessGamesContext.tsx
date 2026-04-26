import { createContext, useContext } from 'react';
import type { ParsedGame } from '../types/chess';

export interface ChessGamesContextValue {
  games: ParsedGame[];
  loading: boolean;
  error: string | null;
  username: string;
  selectedGame: ParsedGame | null;
  fetchGames: (username: string, months: number) => Promise<void>;
  selectGame: (game: ParsedGame) => void;
  clearGames: () => void;
}

export const ChessGamesContext = createContext<ChessGamesContextValue | null>(null);

export function useChessGamesContext(): ChessGamesContextValue {
  const ctx = useContext(ChessGamesContext);
  if (!ctx) throw new Error('useChessGamesContext must be used inside ChessGamesProvider');
  return ctx;
}
