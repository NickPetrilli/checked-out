import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import useChessGames from './hooks/useChessGames';
import { ChessGamesContext, useChessGamesContext } from './context/ChessGamesContext';
import Home from './pages/Home';
import Analyzer from './pages/Analyzer';
import Heatmap from './pages/Heatmap';

// ── Nav bar ───────────────────────────────────────────────────────────────────

function NavBar() {
  const { username, games, clearGames } = useChessGamesContext();
  const navigate = useNavigate();

  const linkBase = 'px-3 py-1.5 rounded text-sm font-medium transition-colors';
  const active   = `${linkBase} bg-blue-600 text-white`;
  const inactive = `${linkBase} text-gray-300 hover:bg-gray-700 hover:text-white`;

  function handleReset() {
    clearGames();
    navigate('/');
  }

  return (
    <nav
      aria-label="Main navigation"
      className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800 bg-gray-900 flex-wrap min-h-[52px]"
    >
      {/* Logo */}
      <span className="mr-2 text-base font-bold text-white select-none" aria-hidden="true">
        ♟
      </span>
      <span className="font-bold text-white text-base mr-auto">Chess Analyzer</span>

      {/* Loaded-user chip */}
      {username && (
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm">
          <span className="text-gray-300 font-medium">{username}</span>
          <span className="text-gray-600">·</span>
          <span className="text-gray-400 tabular-nums">{games.length} game{games.length !== 1 ? 's' : ''}</span>
          <button
            onClick={handleReset}
            aria-label="Reset — clear loaded games and return to Home"
            className="ml-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            ✕
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
        <Route path="/heatmap"  element={<Heatmap />} />
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
        <div className="min-h-screen bg-gray-950 flex flex-col text-gray-100">
          <NavBar />
          <AnimatedRoutes />
        </div>
      </ChessGamesContext.Provider>
    </BrowserRouter>
  );
}
