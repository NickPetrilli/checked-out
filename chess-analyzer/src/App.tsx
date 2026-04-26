import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import useChessGames from './hooks/useChessGames';
import { ChessGamesContext } from './context/ChessGamesContext';
import Home from './pages/Home';
import Analyzer from './pages/Analyzer';
import Heatmap from './pages/Heatmap';

function NavBar() {
  const base = 'px-4 py-2 rounded text-sm font-medium transition-colors';
  const active = `${base} bg-blue-500 text-white`;
  const inactive = `${base} text-gray-300 hover:bg-gray-700 hover:text-white`;

  return (
    <nav className="flex items-center gap-2 px-6 py-3 border-b border-gray-700 bg-gray-900">
      <span className="mr-auto text-lg font-bold text-white">♟ Chess Analyzer</span>
      <NavLink to="/" end className={({ isActive }) => (isActive ? active : inactive)}>
        Home
      </NavLink>
      <NavLink to="/analyzer" className={({ isActive }) => (isActive ? active : inactive)}>
        Analyzer
      </NavLink>
      <NavLink to="/heatmap" className={({ isActive }) => (isActive ? active : inactive)}>
        Heatmap
      </NavLink>
    </nav>
  );
}

export default function App() {
  const chessGames = useChessGames();

  return (
    <BrowserRouter>
      <ChessGamesContext.Provider value={chessGames}>
        <div className="min-h-screen bg-gray-950 flex flex-col text-gray-100">
          <NavBar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/analyzer" element={<Analyzer />} />
            <Route path="/heatmap" element={<Heatmap />} />
          </Routes>
        </div>
      </ChessGamesContext.Provider>
    </BrowserRouter>
  );
}
