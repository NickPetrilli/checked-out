# Chess Analyzer

A React + TypeScript web app for exploring and analyzing Chess.com game history. Load games for any public Chess.com username, replay them move-by-move with Stockfish engine evaluation, and visualize square activity across hundreds of games with a move heatmap.

## Features

- **Home** — search any public Chess.com username, choose how many months of history to load (1–12), see a win/loss/draw summary and date range
- **Game Analyzer** — three-panel layout: filterable game list on the left, interactive chessboard in the center, evaluation bar + move list + summary panel on the right; Stockfish depth-15 engine evaluates every position and flags blunders (>300 cp drop) and mistakes (>100 cp drop)
- **Move Heatmap** — visualize square activity across all loaded games; filter by piece type, color played, origins vs. destinations, and game result

### Technical highlights

- Stockfish 18 Lite runs entirely in the browser as a Web Worker (no server required)
- Chess.com public API — no API key needed
- Automatic 429 rate-limit retry and user-friendly error messages
- Results cached in memory so switching months/filters doesn't re-fetch
- Three-stage `useMemo` pipeline in Heatmap (parse once, filter, aggregate) for fast filter response

## Stack

| Layer | Library |
|---|---|
| UI framework | React 19 + TypeScript |
| Build tool | Vite 8 |
| Routing | React Router v7 |
| Chess logic | chess.js |
| Board rendering | react-chessboard v5 |
| Engine | stockfish-18-lite-single (WASM) |
| HTTP | axios |
| Styling | Tailwind CSS v4 |

## Prerequisites

- **Node.js 18+** (v20 LTS recommended)
- **npm 9+** (comes with Node)
- No API keys or accounts required — Chess.com's public API is used directly

## Getting started

```bash
# From the repo root
cd chess-analyzer

# Install dependencies (first time only)
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Other commands

```bash
# Type-check without building
npx tsc --noEmit

# Production build (outputs to dist/)
npm run build

# Preview the production build locally
npm run preview

# Lint
npm run lint
```

## Configuration

No environment variables or config files are needed. The only external dependency is the Chess.com public API, which is open and unauthenticated.

The Stockfish WASM files (`stockfish-18-lite-single.js` and `.wasm`) are copied from `node_modules/stockfish/` into `public/` automatically at build/dev start by a custom Vite plugin in `vite.config.ts`.

## Project structure

```
chess-analyzer/
├── public/
│   ├── stockfish-18-lite-single.js   # copied by vite plugin
│   └── stockfish-18-lite-single.wasm
├── src/
│   ├── components/
│   │   ├── GameList.tsx      # filterable, paginated game list
│   │   └── HeatmapGrid.tsx   # 8x8 heat grid with tooltip
│   ├── context/
│   │   └── ChessGamesContext.tsx  # shared game state across pages
│   ├── hooks/
│   │   ├── useChessGames.ts  # fetch, parse, cache Chess.com games
│   │   └── useDebounce.ts    # generic debounce hook
│   ├── pages/
│   │   ├── Home.tsx          # search + summary
│   │   ├── Analyzer.tsx      # board + engine evaluation
│   │   └── Heatmap.tsx       # move frequency visualization
│   ├── services/
│   │   ├── chesscom.ts       # Chess.com API client
│   │   └── stockfish.ts      # Stockfish UCI Web Worker wrapper
│   ├── types/
│   │   └── chess.ts          # shared TypeScript interfaces
│   ├── App.tsx               # router, nav bar, context provider
│   └── index.css             # Tailwind import + page transitions
├── vite.config.ts
└── package.json
```
