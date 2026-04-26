import axios from 'axios';
import type { ChessGame, GamesArchive } from '../types/chess';

const BASE_URL = 'https://api.chess.com/pub';

export async function getPlayerArchives(username: string): Promise<string[]> {
  const { data } = await axios.get<{ archives: string[] }>(
    `${BASE_URL}/player/${username}/games/archives`
  );
  return data.archives;
}

export async function getGamesFromArchive(archiveUrl: string): Promise<ChessGame[]> {
  const { data } = await axios.get<GamesArchive>(archiveUrl);
  return data.games;
}

export async function getRecentGames(username: string, months = 1): Promise<ChessGame[]> {
  const archives = await getPlayerArchives(username);
  const recent = archives.slice(-months);
  const results = await Promise.all(recent.map(getGamesFromArchive));
  return results.flat();
}
