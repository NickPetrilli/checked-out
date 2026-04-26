import { useState } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/ChessBoard';
import GameList from '../components/GameList';
import { useChessGames } from '../hooks/useChessGames';
import type { ChessGame } from '../types/chess';

export default function Analyzer() {
  const { games, loading, error, fetchGames } = useChessGames();
  const [username, setUsername] = useState('');
  const [chess] = useState(new Chess());
  const [fen, setFen] = useState(chess.fen());

  function handleMove(from: string, to: string): boolean {
    try {
      chess.move({ from, to, promotion: 'q' });
      setFen(chess.fen());
      return true;
    } catch {
      return false;
    }
  }

  function handleSelectGame(game: ChessGame) {
    chess.loadPgn(game.pgn);
    setFen(chess.fen());
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6">
      <aside className="w-full lg:w-72 flex flex-col gap-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Chess.com username"
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => fetchGames(username)}
            disabled={loading || !username}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '...' : 'Load'}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <GameList games={games} onSelect={handleSelectGame} />
      </aside>

      <section className="flex-1 flex flex-col items-center gap-4">
        <ChessBoard fen={fen} onMove={handleMove} />
        <p className="text-xs text-gray-400 font-mono">{fen}</p>
      </section>
    </div>
  );
}
