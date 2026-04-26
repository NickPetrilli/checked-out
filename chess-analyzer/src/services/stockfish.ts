export interface EvalResult {
  /** Centipawns from white's perspective. ±10 000 = forced mate. */
  score: number;
  bestMove: string;
}

let worker: Worker | null = null;
let initPromise: Promise<void> | null = null;

// All evaluations run sequentially via this chain.
let chain = Promise.resolve();

// ── Worker bootstrap ─────────────────────────────────────────────────────────

function waitForLine(w: Worker, predicate: (line: string) => boolean): Promise<void> {
  return new Promise((resolve) => {
    const handler = ({ data }: MessageEvent<string>) => {
      if (typeof data === 'string' && predicate(data)) {
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
    w.postMessage('uci');
    await waitForLine(w, (l) => l.trim() === 'uciok');
    w.postMessage('isready');
    await waitForLine(w, (l) => l.trim() === 'readyok');
    worker = w;
  })();

  return initPromise;
}

// ── Score helpers ─────────────────────────────────────────────────────────────

/**
 * Stockfish returns scores from the perspective of the side to move.
 * Normalise to always be from white's perspective.
 */
function normalisedScore(raw: number, fen: string): number {
  return fen.split(' ')[1] === 'b' ? -raw : raw;
}

// ── Core evaluation ──────────────────────────────────────────────────────────

function runEval(fen: string, depth: number): Promise<EvalResult> {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error('Stockfish worker not ready'));
      return;
    }
    const w = worker;
    let lastScore = 0;

    const handler = ({ data }: MessageEvent<string>) => {
      if (typeof data !== 'string') return;

      const cpMatch = data.match(/score cp (-?\d+)/);
      if (cpMatch) lastScore = normalisedScore(parseInt(cpMatch[1], 10), fen);

      const mateMatch = data.match(/score mate (-?\d+)/);
      if (mateMatch) {
        const n = parseInt(mateMatch[1], 10);
        lastScore = normalisedScore(n > 0 ? 10_000 : -10_000, fen);
      }

      const bmMatch = data.match(/^bestmove\s+(\S+)/);
      if (bmMatch) {
        w.removeEventListener('message', handler);
        const bestMove = bmMatch[1] === '(none)' ? '' : bmMatch[1];
        resolve({ score: lastScore, bestMove });
      }
    };

    w.addEventListener('message', handler);
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go depth ${depth}`);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Evaluate a position. Requests are queued so only one runs at a time.
 */
export async function evaluatePosition(fen: string, depth = 15): Promise<EvalResult> {
  await ensureWorker();
  const result = chain.then(() => runEval(fen, depth));
  // Advance the tail; swallow errors so the chain never breaks permanently.
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
