import { useState, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import type { ChessComGame, ParsedGame } from '../types/chess';
import { getRecentGames } from '../services/chesscom';

function deriveResult(game: ChessComGame): ParsedGame['result'] {
  const { white, black } = game;
  if (white.result === 'win') return 'white';
  if (black.result === 'win') return 'black';
  return 'draw';
}

const COMPUTER_USERNAME_PATTERNS = /computer|stockfish|komodo|leela|bot\b|coach/i;
const COMPUTER_EVENT_PATTERNS    = /computer|coach|lesson|drill|puzzle/i;

function detectGameType(raw: ChessComGame, pgnHeaders: Record<string, string>): ParsedGame['gameType'] {
  const event = pgnHeaders['Event'] ?? '';
  if (COMPUTER_EVENT_PATTERNS.test(event)) return 'computer';

  const white = raw.white.username;
  const black = raw.black.username;
  if (COMPUTER_USERNAME_PATTERNS.test(white) || COMPUTER_USERNAME_PATTERNS.test(black)) {
    return 'computer';
  }

  return 'online';
}

function parseGame(raw: ChessComGame): ParsedGame {
  let date = new Date(raw.end_time * 1000).toISOString().slice(0, 10);
  let headers: Record<string, string> = {};
  try {
    const chess = new Chess();
    chess.loadPgn(raw.pgn);
    headers = chess.header();
    const pgnDate = headers['Date'];
    if (pgnDate) date = pgnDate.replace(/\./g, '-');
  } catch {
    // fall back to end_time-derived date
  }

  const id = raw.url || `${raw.white.username}-${raw.black.username}-${date}`;

  return {
    id,
    white: raw.white.username,
    black: raw.black.username,
    whiteRating: raw.white.rating,
    blackRating: raw.black.rating,
    date,
    pgn: raw.pgn,
    timeControl: raw.time_control,
    result: deriveResult(raw),
    gameType: detectGameType(raw, headers),
  };
}

interface UseChessGamesResult {
  games: ParsedGame[];
  loading: boolean;
  error: string | null;
  username: string;
  selectedGame: ParsedGame | null;
  fetchGames: (username: string, months: number) => Promise<void>;
  selectGame: (game: ParsedGame) => void;
  clearGames: () => void;
}

export default function useChessGames(): UseChessGamesResult {
  const [games, setGames] = useState<ParsedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [selectedGame, setSelectedGame] = useState<ParsedGame | null>(null);

  const cache = useRef<Map<string, ParsedGame[]>>(new Map());

  const fetchGames = useCallback(async (user: string, months: number) => {
    const key = `${user}-${months}`;
    const cached = cache.current.get(key);
    if (cached) {
      setGames(cached);
      setUsername(user);
      return;
    }

    setLoading(true);
    setError(null);
    setUsername(user);
    try {
      const raw = await getRecentGames(user, months);
      const parsed = raw.map(parseGame);
      cache.current.set(key, parsed);
      setGames(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch games');
    } finally {
      setLoading(false);
    }
  }, []);

  const selectGame = useCallback((game: ParsedGame) => {
    setSelectedGame(game);
  }, []);

  const clearGames = useCallback(() => {
    setGames([]);
    setError(null);
    setUsername('');
    setSelectedGame(null);
    cache.current.clear();
  }, []);

  return { games, loading, error, username, selectedGame, fetchGames, selectGame, clearGames };
}
