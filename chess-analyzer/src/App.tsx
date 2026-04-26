import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import Analyzer from './pages/Analyzer';
import Heatmap from './pages/Heatmap';

function NavBar() {
  const base = 'px-4 py-2 rounded text-sm font-medium transition-colors';
  const active = `${base} bg-blue-600 text-white`;
  const inactive = `${base} text-gray-600 hover:bg-gray-100`;

  return (
    <nav className="flex items-center gap-2 px-6 py-3 border-b border-gray-200 bg-white shadow-sm">
      <span className="mr-auto text-lg font-bold text-gray-800">♟ Chess Analyzer</span>
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
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <NavBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/analyzer" element={<Analyzer />} />
          <Route path="/heatmap" element={<Heatmap />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
