import { useState } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/ChessBoard';
import GameList from '../components/GameList';
import { useChessGamesContext } from '../context/ChessGamesContext';
import type { ParsedGame } from '../types/chess';

export default function Analyzer() {
  const { games, loading, error } = useChessGamesContext();
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

  function handleSelectGame(game: ParsedGame) {
    chess.loadPgn(game.pgn);
    setFen(chess.fen());
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6">
      <aside className="w-full lg:w-72 flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-white">Games</h2>
        {loading && <p className="text-gray-400 text-sm">Loading…</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {!loading && games.length === 0 && !error && (
          <p className="text-gray-500 text-sm">Fetch games on the Home page to get started.</p>
        )}
        <GameList games={games} onSelect={handleSelectGame} />
      </aside>

      <section className="flex-1 flex flex-col items-center gap-4">
        <ChessBoard fen={fen} onMove={handleMove} />
        <p className="text-xs text-gray-600 font-mono">{fen}</p>
      </section>
    </div>
  );
}
