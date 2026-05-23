const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// In dev, call Gemini directly (key stays in gitignored .env).
// In production, the /api/explain proxy keeps the key off the client bundle.
function explainUrl(body: unknown): { url: string; bodyOverride?: unknown } {
  if (import.meta.env.DEV) {
    const key = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
    if (!key) throw new Error('Add VITE_GEMINI_API_KEY to your .env file and restart the dev server.');
    return { url: `${GEMINI_URL}?key=${key}`, bodyOverride: body };
  }
  return { url: '/api/explain', bodyOverride: body };
}

export interface ExplainParams {
  fen:            string;
  movePlayed:     string;
  bestMove:       string;
  classification: string;
  playerColor:    'white' | 'black';
  moveNumber:     number;
}

const SYSTEM_PROMPT =
  'You are a chess coach analyzing a game. Be concise, clear, and instructive. Respond in 3-4 sentences max.';

function buildUserPrompt(params: ExplainParams): string {
  const { fen, movePlayed, bestMove, classification, playerColor, moveNumber } = params;

  if (classification === 'best' || classification === 'excellent') {
    return (
      `The player just played ${movePlayed} (move ${moveNumber}, ${playerColor}) in this position (FEN: ${fen}). ` +
      `This was an excellent move. ` +
      `Explain in plain English: why this move is strong, what it accomplishes positionally or tactically, and what principle it demonstrates.`
    );
  }

  const label = classification.charAt(0).toUpperCase() + classification.slice(1);
  return (
    `The player just played ${movePlayed} (move ${moveNumber}, ${playerColor}) in this position (FEN: ${fen}). ` +
    `This move was classified as a ${label}. The best move was ${bestMove}. ` +
    `Explain in plain English: why was the played move bad, what does the best move accomplish, and what should the player learn from this?`
  );
}

export async function explainMove(params: ExplainParams): Promise<string> {
  const body = {
    contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(params)}` }] }],
    generationConfig: {
      maxOutputTokens: 512,
      temperature: 0.4,
    },
  };

  const { url, bodyOverride } = explainUrl(body);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyOverride ?? body),
  });

  if (res.status === 429) {
    throw new Error('Rate limit reached. Please wait a moment before requesting another explanation.');
  }

  if (!res.ok) {
    throw new Error(`Gemini API returned ${res.status}`);
  }

  const data = await res.json() as {
    candidates?: {
      content?:      { parts?: { text?: string }[] };
      finishReason?: string;
    }[];
  };

  const candidate    = data.candidates?.[0];
  const text         = candidate?.content?.parts?.[0]?.text;
  const finishReason = candidate?.finishReason;

  if (!text) throw new Error('Empty response from Gemini');

  if (finishReason === 'MAX_TOKENS') {
    const lastPeriod = Math.max(
      text.lastIndexOf('. '),
      text.lastIndexOf('! '),
      text.lastIndexOf('? '),
    );
    const trimmed = lastPeriod > 0 ? text.slice(0, lastPeriod + 1) : text;
    return trimmed.trim();
  }

  return text.trim();
}
