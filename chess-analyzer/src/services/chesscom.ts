import axios from 'axios';
import type { ChessComGame, ChessComProfile } from '../types/chess';

const BASE_URL = 'https://api.chess.com/pub';

const HEADERS = {
  'User-Agent': 'chess-analyzer-app/1.0 (contact: dev@chessanalyzer.com)',
};

// ── Fetch helper with 429 retry ───────────────────────────────────────────────

async function get<T>(url: string): Promise<T> {
  const attempt = () => axios.get<T>(url, { headers: HEADERS }).then((r) => r.data);
  try {
    return await attempt();
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 429) {
      await new Promise((r) => setTimeout(r, 2_000));
      return attempt(); // throws on second failure — caller handles it
    }
    throw err;
  }
}

function apiError(err: unknown, fallback: string): never {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 404) throw new Error('Player not found on Chess.com. Check the username.');
    if (status === 429) throw new Error('Chess.com rate limit exceeded. Please wait a moment and try again.');
    if (status && status >= 500) throw new Error('Chess.com is currently unavailable. Try again later.');
    if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED')
      throw new Error('Network error. Check your internet connection.');
  }
  throw new Error(fallback);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getPlayerProfile(username: string): Promise<ChessComProfile | null> {
  try {
    return await get<ChessComProfile>(`${BASE_URL}/player/${username}`);
  } catch (err) {
    console.error(`Failed to fetch profile for "${username}":`, err);
    return null;
  }
}

export async function getGameArchives(username: string): Promise<string[]> {
  try {
    const data = await get<{ archives: string[] }>(
      `${BASE_URL}/player/${username}/games/archives`,
    );
    return data.archives;
  } catch (err) {
    apiError(err, 'Failed to load game archives');
  }
}

export async function getGamesForMonth(archiveUrl: string): Promise<ChessComGame[]> {
  try {
    const data = await get<{ games: ChessComGame[] }>(archiveUrl);
    return data.games ?? [];
  } catch (err) {
    console.error(`Failed to fetch games from "${archiveUrl}":`, err);
    return [];
  }
}

export async function getRecentGames(username: string, months: number): Promise<ChessComGame[]> {
  const archives = await getGameArchives(username);
  const recent = archives.slice(-months);
  const results = await Promise.all(recent.map(getGamesForMonth));
  return results.flat().reverse();
}
