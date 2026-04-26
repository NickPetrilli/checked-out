import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[80vh] gap-6 px-4">
      <h1 className="text-4xl font-bold text-gray-800">Chess Analyzer</h1>
      <p className="text-gray-500 text-lg max-w-md text-center">
        Load your Chess.com games, analyze them with Stockfish, and explore move heatmaps.
      </p>
      <div className="flex gap-4">
        <Link
          to="/analyzer"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Open Analyzer
        </Link>
        <Link
          to="/heatmap"
          className="px-6 py-3 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          View Heatmap
        </Link>
      </div>
    </main>
  );
}
