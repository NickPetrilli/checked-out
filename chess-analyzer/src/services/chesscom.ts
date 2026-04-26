import axios from 'axios';
import type { ChessComGame, ChessComProfile } from '../types/chess';

const BASE_URL = 'https://api.chess.com/pub';

const headers = {
  'User-Agent': 'chess-analyzer-app/1.0 (contact: dev@chessanalyzer.com)',
};

export async function getPlayerProfile(username: string): Promise<ChessComProfile | null> {
  try {
    const { data } = await axios.get<ChessComProfile>(
      `${BASE_URL}/player/${username}`,
      { headers }
    );
    return data;
  } catch (err) {
    console.error(`Failed to fetch profile for "${username}":`, err);
    return null;
  }
}

export async function getGameArchives(username: string): Promise<string[]> {
  try {
    const { data } = await axios.get<{ archives: string[] }>(
      `${BASE_URL}/player/${username}/games/archives`,
      { headers }
    );
    return data.archives;
  } catch (err) {
    console.error(`Failed to fetch archives for "${username}":`, err);
    return [];
  }
}

export async function getGamesForMonth(archiveUrl: string): Promise<ChessComGame[]> {
  try {
    const { data } = await axios.get<{ games: ChessComGame[] }>(archiveUrl, { headers });
    return data.games;
  } catch (err) {
    console.error(`Failed to fetch games from "${archiveUrl}":`, err);
    return [];
  }
}

export async function getRecentGames(username: string, months: number): Promise<ChessComGame[]> {
  const archives = await getGameArchives(username);
  const recent = archives.slice(-months);
  const results = await Promise.all(recent.map(getGamesForMonth));
  return results.flat();
}
