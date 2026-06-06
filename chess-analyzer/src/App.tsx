import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import useChessGames from './hooks/useChessGames';
import { ChessGamesContext, useChessGamesContext } from './context/ChessGamesContext';
import Home from './pages/Home';
import Analyzer from './pages/Analyzer';
import Heatmap from './pages/Heatmap';
import Playground from './pages/Playground';

// ── Nav bar ───────────────────────────────────────────────────────────────────


function NavBar() {
  const { username, games, clearGames } = useChessGamesContext();
  const navigate = useNavigate();

  function handleReset() {
    clearGames();
    navigate('/');
  }

  const linkBase =
    'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer relative';
  const active   = `${linkBase} text-white`;
  const inactive = `${linkBase} text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.05]`;

  return (
    <nav
      aria-label="Main navigation"
      className="wood-grain flex items-center gap-2 px-4 py-3 flex-wrap"
      style={{
        minHeight: 60,
        backgroundColor: 'rgba(38, 20, 8, 0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(212, 168, 67, 0.18)',
        boxShadow: '0 1px 0 rgba(255,220,120,0.05), 0 4px 24px rgba(0,0,0,0.5)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mr-auto cursor-default select-none">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(82,176,68,0.18) 0%, rgba(82,176,68,0.06) 100%)',
            border: '1px solid rgba(82,176,68,0.28)',
            boxShadow: '0 2px 12px rgba(82,176,68,0.22), 0 1px 0 rgba(255,255,255,0.06) inset',
            fontSize: 18,
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          ♚
        </div>
        <span
          className="font-bold text-base tracking-tight"
          style={{ color: 'var(--text-accent)', letterSpacing: '-0.03em' }}
        >
          Checked Out
        </span>
      </div>

      {/* Loaded-user chip */}
      {username && (
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1 text-sm"
          style={{
            backgroundColor: 'rgba(82, 176, 68, 0.1)',
            border: '1px solid rgba(82, 176, 68, 0.22)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: 'var(--brand-green)', boxShadow: '0 0 6px var(--brand-green-glow)' }}
            aria-hidden="true"
          />
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{username}</span>
          <span style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>·</span>
          <span className="tabular-nums" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            {games.length} game{games.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleReset}
            aria-label="Reset — clear loaded games and return to Home"
            className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full transition-all duration-150 cursor-pointer"
            style={{ color: 'var(--text-secondary)', fontSize: 11 }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#f87171';
              e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.12)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Nav links */}
      <div className="flex items-center gap-0.5">
        <NavLink
          to="/"
          end
          aria-label="Home"
          className={({ isActive }) => (isActive ? active : inactive)}
          style={({ isActive }) => isActive ? {
            background: 'rgba(82, 176, 68, 0.14)',
            color: 'var(--brand-green)',
            boxShadow: '0 0 0 1px rgba(82, 176, 68, 0.2)',
          } : {}}
        >
          Home
        </NavLink>
        <NavLink
          to="/analyzer"
          aria-label="Game Analyzer"
          className={({ isActive }) => (isActive ? active : inactive)}
          style={({ isActive }) => isActive ? {
            background: 'rgba(82, 176, 68, 0.14)',
            color: 'var(--brand-green)',
            boxShadow: '0 0 0 1px rgba(82, 176, 68, 0.2)',
          } : {}}
        >
          Analyzer
        </NavLink>
        <NavLink
          to="/heatmap"
          aria-label="Move Heatmap"
          className={({ isActive }) => (isActive ? active : inactive)}
          style={({ isActive }) => isActive ? {
            background: 'rgba(82, 176, 68, 0.14)',
            color: 'var(--brand-green)',
            boxShadow: '0 0 0 1px rgba(82, 176, 68, 0.2)',
          } : {}}
        >
          Heatmap
        </NavLink>
        <NavLink
          to="/playground"
          aria-label="Playground"
          className={({ isActive }) => (isActive ? active : inactive)}
          style={({ isActive }) => isActive ? {
            background: 'rgba(82, 176, 68, 0.14)',
            color: 'var(--brand-green)',
            boxShadow: '0 0 0 1px rgba(82, 176, 68, 0.2)',
          } : {}}
        >
          Playground
        </NavLink>
      </div>
    </nav>
  );
}

// ── Animated route wrapper ────────────────────────────────────────────────────

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition flex flex-col flex-1 min-h-0">
      <Routes>
        <Route path="/"           element={<Home />} />
        <Route path="/analyzer"   element={<Analyzer />} />
        <Route path="/heatmap"    element={<Heatmap />} />
        <Route path="/playground" element={<Playground />} />
      </Routes>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const chessGames = useChessGames();

  return (
    <BrowserRouter>
      <ChessGamesContext.Provider value={chessGames}>
        <div
          className="min-h-screen flex flex-col"
          style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        >
          <NavBar />
          <AnimatedRoutes />
        </div>
      </ChessGamesContext.Provider>
    </BrowserRouter>
  );
}
