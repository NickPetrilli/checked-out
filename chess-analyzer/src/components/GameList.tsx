import { useState, useMemo } from 'react';
import type { ParsedGame } from '../types/chess';
import { useChessGamesContext } from '../context/ChessGamesContext';

const PAGE_SIZE = 50;

type ColorFilter    = 'all' | 'white' | 'black';
type ResultFilter   = 'all' | 'wins' | 'losses' | 'draws';
type GameTypeFilter = 'all' | 'online' | 'computer';

interface GameListProps {
  games:        ParsedGame[];
  selectedGame: ParsedGame | null;
  onSelectGame: (game: ParsedGame) => void;
}

function resultLabel(result: ParsedGame['result']): string {
  if (result === 'white') return '1-0';
  if (result === 'black') return '0-1';
  return '½-½';
}

function resultColor(result: ParsedGame['result']): string {
  if (result === 'white') return 'var(--brand-green)';
  if (result === 'black') return 'var(--move-blunder)';
  return 'var(--move-inaccuracy)';
}

function playerResultFor(game: ParsedGame, username: string): 'win' | 'loss' | 'draw' {
  if (game.result === 'draw') return 'draw';
  const playingWhite = game.white.toLowerCase() === username.toLowerCase();
  return (game.result === 'white') === playingWhite ? 'win' : 'loss';
}

function prColor(pr: 'win' | 'loss' | 'draw'): string {
  if (pr === 'win')  return 'var(--brand-green)';
  if (pr === 'loss') return 'var(--move-blunder)';
  return 'var(--move-inaccuracy)';
}

export default function GameList({ games, selectedGame, onSelectGame }: GameListProps) {
  const { username } = useChessGamesContext();
  const [colorFilter,    setColorFilter]    = useState<ColorFilter>('all');
  const [resultFilter,   setResultFilter]   = useState<ResultFilter>('all');
  const [gameTypeFilter, setGameTypeFilter] = useState<GameTypeFilter>('all');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    return games.filter((game) => {
      if (colorFilter !== 'all') {
        const playingWhite = game.white.toLowerCase() === username.toLowerCase();
        if (colorFilter === 'white' && !playingWhite) return false;
        if (colorFilter === 'black' && playingWhite)  return false;
      }
      if (resultFilter !== 'all') {
        const pr = playerResultFor(game, username);
        if (resultFilter === 'wins'   && pr !== 'win')   return false;
        if (resultFilter === 'losses' && pr !== 'loss')  return false;
        if (resultFilter === 'draws'  && pr !== 'draw')  return false;
      }
      if (gameTypeFilter !== 'all' && game.gameType !== gameTypeFilter) return false;
      return true;
    });
  }, [games, colorFilter, resultFilter, gameTypeFilter, username]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.length > PAGE_SIZE
    ? filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : filtered;

  function handleFilterChange() { setPage(0); }

  if (games.length === 0) {
    return (
      <p className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
        No games loaded.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 min-h-0">
      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        <FilterSelect
          value={colorFilter}
          options={[
            { value: 'all',   label: 'All colors' },
            { value: 'white', label: 'White' },
            { value: 'black', label: 'Black' },
          ]}
          onChange={(v) => { setColorFilter(v as ColorFilter); handleFilterChange(); }}
        />
        <FilterSelect
          value={resultFilter}
          options={[
            { value: 'all',    label: 'All results' },
            { value: 'wins',   label: 'Wins' },
            { value: 'losses', label: 'Losses' },
            { value: 'draws',  label: 'Draws' },
          ]}
          onChange={(v) => { setResultFilter(v as ResultFilter); handleFilterChange(); }}
        />
        <FilterSelect
          value={gameTypeFilter}
          options={[
            { value: 'all',      label: 'All opponents' },
            { value: 'online',   label: 'Online' },
            { value: 'computer', label: 'vs Computer/Coach' },
          ]}
          onChange={(v) => { setGameTypeFilter(v as GameTypeFilter); handleFilterChange(); }}
        />
        <span className="ml-auto text-xs self-center" style={{ color: 'var(--text-secondary)' }}>
          {filtered.length} game{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
          No games match the current filters.
        </p>
      ) : (
        <ul
          className="overflow-hidden rounded-lg"
          style={{ border: '1px solid rgba(255,255,255,0.07)' }}
          role="listbox"
          aria-label="Games"
        >
          {paginated.map((game, idx) => {
            const isSelected = selectedGame?.id === game.id;
            const pr = playerResultFor(game, username);
            return (
              <li
                key={game.id}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => onSelectGame(game)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectGame(game);
                  }
                }}
                aria-label={`${game.white} vs ${game.black}, ${resultLabel(game.result)}, ${game.date}`}
                className="flex flex-col px-3 py-2.5 cursor-pointer text-sm gap-0.5 focus:outline-none transition-colors"
                style={{
                  borderLeft: `2px solid ${isSelected ? 'var(--brand-green)' : 'transparent'}`,
                  backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                  borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : undefined,
                }}
                onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                }}
                onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {/* Players row */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {game.white}
                    <span className="font-normal text-xs ml-1" style={{ color: 'var(--text-secondary)' }}>
                      ({game.whiteRating})
                    </span>
                    <span className="font-normal mx-1" style={{ color: 'var(--text-secondary)' }}>vs</span>
                    {game.black}
                    <span className="font-normal text-xs ml-1" style={{ color: 'var(--text-secondary)' }}>
                      ({game.blackRating})
                    </span>
                  </span>
                  <span
                    className="font-bold tabular-nums shrink-0"
                    style={{ color: resultColor(game.result) }}
                  >
                    {resultLabel(game.result)}
                  </span>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span>{game.date}</span>
                  <span>·</span>
                  <span>{game.timeControl}</span>
                  {username && (
                    <>
                      <span>·</span>
                      <span style={{ color: prColor(pr) }}>
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
            className="btn-secondary disabled:opacity-30"
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            ← Prev
          </button>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
            className="btn-secondary disabled:opacity-30"
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

interface FilterSelectProps {
  value:   string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FilterSelect({ value, options, onChange }: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs rounded px-2 py-1.5 focus:outline-none"
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'var(--text-secondary)',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
