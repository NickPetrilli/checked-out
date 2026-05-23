import ChessBoard from '../components/ChessBoard';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const RIGHT_WIDTH  = 340;

export default function Playground() {
  // Same height constraint as Analyzer: viewport minus 52px nav bar.
  // Board max-width mirrors Analyzer so the square never overflows vertically.
  const boardAreaMaxWidth = 'min(100%, calc(100vh - 220px))';

  return (
    <div
      className="flex h-[calc(100vh-52px)] overflow-hidden"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* ── Center: eval bar + board ─────────────────────────────────────── */}
      <main
        aria-label="Playground chess board"
        className="flex flex-col items-center justify-start gap-2 p-4 overflow-y-auto flex-1 min-w-0"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="flex flex-col w-full mx-auto" style={{ maxWidth: boardAreaMaxWidth }}>
          {/* Eval bar (20px) + board side by side — mirrors Analyzer layout */}
          <div className="flex items-stretch gap-1.5">
            {/* Eval bar placeholder — will hold live evaluation once engine is wired */}
            <div
              style={{
                width: 20,
                minHeight: 80,
                flexShrink: 0,
                alignSelf: 'stretch',
                borderRadius: 2,
                backgroundColor: 'var(--eval-bar-bg)',
              }}
            />
            <div className="flex-1">
              <ChessBoard fen={STARTING_FEN} />
            </div>
          </div>
        </div>
      </main>

      {/* ── Right: best moves panel ──────────────────────────────────────── */}
      <aside
        aria-label="Best moves panel"
        className="shrink-0 flex flex-col items-center justify-center overflow-hidden"
        style={{
          width: RIGHT_WIDTH,
          backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', opacity: 0.5 }}>
          Best Moves will appear here
        </p>
      </aside>
    </div>
  );
}
