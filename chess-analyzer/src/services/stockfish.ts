export interface EvalResult {
  /** Centipawns from white's perspective. ±10 000 = forced mate. */
  score: number;
  bestMove: string;
  /** Principal variation in UCI notation (empty if unavailable). */
  pv: string[];
}

export interface PVLine {
  rank: number;
  score: number;
  bestMove: string;
  pv: string[];
  depth: number;
}

export interface MultiPVResult {
  lines: PVLine[];
  depth: number;
}

let worker: Worker | null = null;
let initPromise: Promise<void> | null = null;
let chain = Promise.resolve();

// ── Worker bootstrap ──────────────────────────────────────────────────────────

function waitForLine(
  w: Worker,
  predicate: (line: string) => boolean,
  timeoutMs = 10_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      w.removeEventListener('message', handler);
      reject(new Error('Chess engine timed out during initialization.'));
    }, timeoutMs);

    const handler = ({ data }: MessageEvent<string>) => {
      if (typeof data === 'string' && predicate(data)) {
        clearTimeout(timer);
        w.removeEventListener('message', handler);
        resolve();
      }
    };
    w.addEventListener('message', handler);
  });
}

function ensureWorker(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const w = new Worker('/stockfish-18-lite-single.js');
    try {
      w.postMessage('uci');
      await waitForLine(w, (l) => l.trim() === 'uciok');
      w.postMessage('isready');
      await waitForLine(w, (l) => l.trim() === 'readyok');
      worker = w;
    } catch (err) {
      w.terminate();
      initPromise = null; // allow retry
      throw err;
    }
  })();

  return initPromise;
}

// ── Score normalisation ───────────────────────────────────────────────────────

function normalisedScore(raw: number, fen: string): number {
  return fen.split(' ')[1] === 'b' ? -raw : raw;
}

// ── Core evaluation ───────────────────────────────────────────────────────────

function runEval(fen: string, depth: number): Promise<EvalResult> {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error('Chess engine is not ready.'));
      return;
    }
    const w = worker;
    let lastScore = 0;
    let lastPv: string[] = [];

    const handler = ({ data }: MessageEvent<string>) => {
      if (typeof data !== 'string') return;

      const cpMatch = data.match(/score cp (-?\d+)/);
      if (cpMatch) lastScore = normalisedScore(parseInt(cpMatch[1], 10), fen);

      const mateMatch = data.match(/score mate (-?\d+)/);
      if (mateMatch) {
        const n = parseInt(mateMatch[1], 10);
        lastScore = normalisedScore(n > 0 ? 10_000 : -10_000, fen);
      }

      const pvMatch = data.match(/\bpv\s+(.+)/);
      if (pvMatch) lastPv = pvMatch[1].trim().split(/\s+/);

      const bmMatch = data.match(/^bestmove\s+(\S+)/);
      if (bmMatch) {
        w.removeEventListener('message', handler);
        resolve({ score: lastScore, bestMove: bmMatch[1] === '(none)' ? '' : bmMatch[1], pv: lastPv });
      }
    };

    w.addEventListener('message', handler);
    w.postMessage('setoption name MultiPV value 1');
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go depth ${depth}`);
  });
}

function runMultiPV(fen: string, depth: number, numLines: number): Promise<MultiPVResult> {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error('Chess engine is not ready.'));
      return;
    }
    const w = worker;
    const lineMap = new Map<number, PVLine>();
    let reachedDepth = 0;

    const handler = ({ data }: MessageEvent<string>) => {
      if (typeof data !== 'string') return;

      const multipvMatch = data.match(/\bmultipv\s+(\d+)/);
      if (multipvMatch) {
        const rank = parseInt(multipvMatch[1], 10);
        const depthMatch = data.match(/\bdepth\s+(\d+)/);
        const lineDepth = depthMatch ? parseInt(depthMatch[1], 10) : 0;

        let score = 0;
        const cpMatch = data.match(/score cp (-?\d+)/);
        if (cpMatch) score = normalisedScore(parseInt(cpMatch[1], 10), fen);
        const mateMatch = data.match(/score mate (-?\d+)/);
        if (mateMatch) {
          const n = parseInt(mateMatch[1], 10);
          score = normalisedScore(n > 0 ? 10_000 : -10_000, fen);
        }

        const pvMatch = data.match(/\bpv\s+(.+)/);
        const pv = pvMatch ? pvMatch[1].trim().split(/\s+/) : [];

        lineMap.set(rank, { rank, score, bestMove: pv[0] ?? '', pv, depth: lineDepth });
        if (lineDepth > reachedDepth) reachedDepth = lineDepth;
      }

      const bmMatch = data.match(/^bestmove/);
      if (bmMatch) {
        w.removeEventListener('message', handler);
        const sorted = Array.from(lineMap.values())
          .sort((a, b) => a.rank - b.rank)
          .slice(0, numLines);
        resolve({ lines: sorted, depth: reachedDepth });
      }
    };

    w.addEventListener('message', handler);
    w.postMessage(`setoption name MultiPV value ${numLines}`);
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go depth ${depth}`);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Call this on Analyzer mount to pre-warm the engine and surface init errors early. */
export function ensureEngineReady(): Promise<void> {
  return ensureWorker();
}

export async function evaluatePosition(fen: string, depth = 15): Promise<EvalResult> {
  await ensureWorker();
  const result = chain.then(() => runEval(fen, depth));
  chain = result.then(
    () => {},
    () => {},
  );
  return result;
}

export async function evaluateMultiPV(fen: string, depth = 18, numLines = 5): Promise<MultiPVResult> {
  await ensureWorker();
  const result = chain.then(() => runMultiPV(fen, depth, numLines));
  chain = result.then(
    () => {},
    () => {},
  );
  return result;
}

export function destroyEngine(): void {
  worker?.terminate();
  worker = null;
  initPromise = null;
  chain = Promise.resolve();
}
