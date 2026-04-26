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
    <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
      {games.map((game) => (
        <li
          key={game.id}
          className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer"
          onClick={() => onSelect?.(game)}
        >
          <span className="font-medium text-sm">
            {game.white} vs {game.black}
          </span>
          <span className="text-xs text-gray-500">{game.timeControl}</span>
        </li>
      ))}
    </ul>
  );
}
