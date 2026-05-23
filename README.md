# Chess Analyzer

A React + TypeScript web app for exploring and analyzing Chess.com game history. Load games for any public Chess.com username, replay them move-by-move with Stockfish engine evaluation, visualize square activity across all your games, and practice freely in an interactive playground.

## Features

- **Home** — search any public Chess.com username, choose how many months of history to load (1–12), see a win/loss/draw summary and date range
- **Game Analyzer** — three-panel layout: filterable game list on the left, interactive chessboard with eval bar in the center, and a right panel with:
  - Move list with blunder/mistake/inaccuracy badges and opening name
  - Player accuracy summaries (Lichess accuracy formula, radial ring per player)
  - Engine lines for the current position (best move + continuation)
  - AI coach explanation for flagged moves (ask why a move was bad)
  - Stockfish depth-15 analysis flags blunders (>300 cp drop), mistakes (>100 cp drop), and inaccuracies (>50 cp drop)
  - Best-move arrow, board flip, and "Best Move" button to reveal the engine's top choice after a bad move
  - 8 board color themes and 4 piece sets (Neo, Classic, Alpha, Merida)
- **Move Heatmap** — visualize square activity across all loaded games; filter by piece type, color played, origins vs. destinations, and game result
- **Playground** — free-play board with:
  - Live Stockfish MultiPV analysis (top 5 engine lines, depth 18)
  - Hint button showing the best move as a green arrow
  - Opening name detection as moves are played (~50 common openings)
  - Move history with keyboard navigation (← →)
  - Board flip, reset, eval bar
  - 8 board color themes and 4 piece sets (shared with Analyzer, persisted to localStorage)

### Technical highlights

- Stockfish 18 Lite runs entirely in the browser as a Web Worker (no server required)
- Chess.com public API — no API key needed
- Automatic 429 rate-limit retry and user-friendly error messages
- Results cached in memory so switching months/filters doesn't re-fetch
- Three-stage `useMemo` pipeline in Heatmap (parse once, filter, aggregate) for fast filter response
- MultiPV evaluation queued via a shared promise chain so Analyzer and Playground never issue concurrent engine calls

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
│   ├── favicon.svg
│   ├── stockfish-18-lite-single.js   # copied by vite plugin
│   └── stockfish-18-lite-single.wasm
├── src/
│   ├── components/
│   │   ├── ChessBoard.tsx    # shared board wrapper (arrows, highlights, legal dots, badges)
│   │   ├── GameList.tsx      # filterable, paginated game list
│   │   └── HeatmapGrid.tsx   # 8x8 heat grid with tooltip
│   ├── context/
│   │   └── ChessGamesContext.tsx  # shared game state across pages
│   ├── hooks/
│   │   ├── useChessGames.ts  # fetch, parse, cache Chess.com games
│   │   └── useDebounce.ts    # generic debounce hook
│   ├── pages/
│   │   ├── Home.tsx          # username search + game summary
│   │   ├── Analyzer.tsx      # board + engine evaluation + AI coach
│   │   ├── Heatmap.tsx       # move frequency visualization
│   │   └── Playground.tsx    # free-play board with live engine analysis
│   ├── services/
│   │   ├── aiExplainer.ts    # AI move explanation (Claude API)
│   │   ├── chesscom.ts       # Chess.com API client
│   │   └── stockfish.ts      # Stockfish UCI Web Worker wrapper (single + MultiPV)
│   ├── types/
│   │   └── chess.ts          # shared TypeScript interfaces
│   ├── utils/
│   │   ├── boardThemes.ts    # 8 board color themes, shared by Analyzer + Playground
│   │   ├── evalBar.tsx       # EvalBar component + score formatting helpers
│   │   ├── openings.ts       # SAN-prefix opening detection (~50 openings)
│   │   └── pieceSets.tsx     # 4 piece sets via Lichess CDN, shared by Analyzer + Playground
│   ├── App.tsx               # router, nav bar, context provider
│   └── index.css             # design tokens, Tailwind, component CSS
├── vite.config.ts
└── package.json
```
