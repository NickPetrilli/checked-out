import { useState, useCallback } from 'react';
import type { ChessGame } from '../types/chess';
import { getRecentGames } from '../services/chesscom';

interface UseChessGamesResult {
  games: ChessGame[];
  loading: boolean;
  error: string | null;
  fetchGames: (username: string, months?: number) => Promise<void>;
}

export function useChessGames(): UseChessGamesResult {
  const [games, setGames] = useState<ChessGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGames = useCallback(async (username: string, months = 1) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRecentGames(username, months);
      setGames(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch games');
    } finally {
      setLoading(false);
    }
  }, []);

  return { games, loading, error, fetchGames };
}
