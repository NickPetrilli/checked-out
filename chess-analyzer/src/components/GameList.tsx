import type { ParsedGame } from '../types/chess';

interface GameListProps {
  games: ParsedGame[];
  onSelect?: (game: ParsedGame) => void;
}

export default function GameList({ games, onSelect }: GameListProps) {
  if (games.length === 0) {
    return <p className="text-gray-500 text-center py-8">No games loaded.</p>;
  }

  return (
    <ul className="divide-y divide-gray-700 border border-gray-700 rounded-lg overflow-hidden">
      {games.map((game) => (
        <li
          key={game.id}
          className="flex items-center justify-between px-4 py-3 hover:bg-gray-700 cursor-pointer transition-colors"
          onClick={() => onSelect?.(game)}
        >
          <span className="font-medium text-sm text-gray-100">
            {game.white} vs {game.black}
          </span>
          <span className="text-xs text-gray-400">{game.timeControl}</span>
        </li>
      ))}
    </ul>
  );
}
