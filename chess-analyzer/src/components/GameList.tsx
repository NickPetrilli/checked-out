import { useState, useMemo } from 'react';
import type { ParsedGame } from '../types/chess';
import { useChessGamesContext } from '../context/ChessGamesContext';

const PAGE_SIZE = 50;

type ColorFilter = 'all' | 'white' | 'black';
type ResultFilter = 'all' | 'wins' | 'losses' | 'draws';

interface GameListProps {
  games: ParsedGame[];
  selectedGame: ParsedGame | null;
  onSelectGame: (game: ParsedGame) => void;
}

function resultLabel(result: ParsedGame['result']): string {
  if (result === 'white') return '1-0';
  if (result === 'black') return '0-1';
  return '½-½';
}

function resultColor(result: ParsedGame['result']): string {
  if (result === 'white') return 'text-green-400';
  if (result === 'black') return 'text-red-400';
  return 'text-yellow-400';
}

function playerResultFor(game: ParsedGame, username: string): 'win' | 'loss' | 'draw' {
  if (game.result === 'draw') return 'draw';
  const playingWhite = game.white.toLowerCase() === username.toLowerCase();
  return (game.result === 'white') === playingWhite ? 'win' : 'loss';
}

export default function GameList({ games, selectedGame, onSelectGame }: GameListProps) {
  const { username } = useChessGamesContext();
  const [colorFilter, setColorFilter] = useState<ColorFilter>('all');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    return games.filter((game) => {
      if (colorFilter !== 'all') {
        const playingWhite = game.white.toLowerCase() === username.toLowerCase();
        if (colorFilter === 'white' && !playingWhite) return false;
        if (colorFilter === 'black' && playingWhite) return false;
      }
      if (resultFilter !== 'all') {
        const pr = playerResultFor(game, username);
        if (resultFilter === 'wins' && pr !== 'win') return false;
        if (resultFilter === 'losses' && pr !== 'loss') return false;
        if (resultFilter === 'draws' && pr !== 'draw') return false;
      }
      return true;
    });
  }, [games, colorFilter, resultFilter, username]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.length > PAGE_SIZE
    ? filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : filtered;

  function handleFilterChange() {
    setPage(0);
  }

  if (games.length === 0) {
    return <p className="text-gray-500 text-center py-8 text-sm">No games loaded.</p>;
  }

  return (
    <div className="flex flex-col gap-2 min-h-0">
      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        <FilterSelect
          label="Color"
          value={colorFilter}
          options={[
            { value: 'all', label: 'All colors' },
            { value: 'white', label: 'White' },
            { value: 'black', label: 'Black' },
          ]}
          onChange={(v) => { setColorFilter(v as ColorFilter); handleFilterChange(); }}
        />
        <FilterSelect
          label="Result"
          value={resultFilter}
          options={[
            { value: 'all', label: 'All results' },
            { value: 'wins', label: 'Wins' },
            { value: 'losses', label: 'Losses' },
            { value: 'draws', label: 'Draws' },
          ]}
          onChange={(v) => { setResultFilter(v as ResultFilter); handleFilterChange(); }}
        />
        <span className="ml-auto text-xs text-gray-500 self-center">
          {filtered.length} game{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-8 text-sm">No games match the current filters.</p>
      ) : (
        <ul className="divide-y divide-gray-700/60 border border-gray-700 rounded-lg overflow-hidden">
          {paginated.map((game) => {
            const isSelected = selectedGame?.id === game.id;
            const pr = playerResultFor(game, username);
            return (
              <li
                key={game.id}
                onClick={() => onSelectGame(game)}
                className={[
                  'flex flex-col px-3 py-2.5 cursor-pointer transition-colors text-sm gap-0.5',
                  isSelected
                    ? 'bg-blue-900/50 border-l-2 border-blue-500'
                    : 'hover:bg-gray-800 border-l-2 border-transparent',
                ].join(' ')}
              >
                {/* Players row */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-100 truncate">
                    {game.white}
                    <span className="text-gray-500 font-normal text-xs ml-1">({game.whiteRating})</span>
                    <span className="text-gray-500 font-normal mx-1">vs</span>
                    {game.black}
                    <span className="text-gray-500 font-normal text-xs ml-1">({game.blackRating})</span>
                  </span>
                  <span className={`font-bold tabular-nums shrink-0 ${resultColor(game.result)}`}>
                    {resultLabel(game.result)}
                  </span>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{game.date}</span>
                  <span>·</span>
                  <span>{game.timeControl}</span>
                  {username && (
                    <>
                      <span>·</span>
                      <span className={
                        pr === 'win' ? 'text-green-500' :
                        pr === 'loss' ? 'text-red-500' :
                        'text-yellow-500'
                      }>
                        {pr === 'win' ? 'Win' : pr === 'loss' ? 'Loss' : 'Draw'}
                      </span>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
            className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded text-gray-300 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded text-gray-300 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FilterSelect({ value, options, onChange }: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
