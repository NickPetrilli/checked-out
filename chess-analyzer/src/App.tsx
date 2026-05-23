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

  const linkBase = 'px-3 py-1.5 rounded text-sm font-medium transition-colors';
  const active   = `${linkBase} bg-brand-green text-white`;
  const inactive = `${linkBase} text-text-secondary hover:bg-bg-tertiary hover:text-text-primary`;

  function handleReset() {
    clearGames();
    navigate('/');
  }

  return (
    <nav
      aria-label="Main navigation"
      className="flex items-center gap-2 px-4 py-2.5 flex-wrap min-h-[52px]"
      style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Logo */}
      <span className="mr-2 text-2xl text-white select-none" aria-hidden="true">
        ♟
      </span>
      <span className="font-bold text-white text-base mr-auto">Checked Out</span>

      {/* Loaded-user chip */}
      {username && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1 text-sm"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{username}</span>
          <span style={{ color: 'var(--text-secondary)', opacity: 0.4 }}>·</span>
          <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{games.length} game{games.length !== 1 ? 's' : ''}</span>
          <button
            onClick={handleReset}
            aria-label="Reset — clear loaded games and return to Home"
            className="ml-1 text-xs transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            &#x2715;
          </button>
        </div>
      )}

      {/* Nav links */}
      <NavLink to="/" end aria-label="Home" className={({ isActive }) => (isActive ? active : inactive)}>
        Home
      </NavLink>
      <NavLink to="/analyzer" aria-label="Game Analyzer" className={({ isActive }) => (isActive ? active : inactive)}>
        Analyzer
      </NavLink>
      <NavLink to="/heatmap" aria-label="Move Heatmap" className={({ isActive }) => (isActive ? active : inactive)}>
        Heatmap
      </NavLink>
      <NavLink to="/playground" aria-label="Playground" className={({ isActive }) => (isActive ? active : inactive)}>
        Playground
      </NavLink>
    </nav>
  );
}

// ── Animated route wrapper ────────────────────────────────────────────────────

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition flex flex-col flex-1 min-h-0">
      <Routes>
        <Route path="/"         element={<Home />} />
        <Route path="/analyzer" element={<Analyzer />} />
        <Route path="/heatmap"      element={<Heatmap />} />
        <Route path="/playground"   element={<Playground />} />
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
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
          <NavBar />
          <AnimatedRoutes />
        </div>
      </ChessGamesContext.Provider>
    </BrowserRouter>
  );
}
