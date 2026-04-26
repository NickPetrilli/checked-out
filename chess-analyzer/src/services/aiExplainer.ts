const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export interface BlunderExplainParams {
  fen:         string;
  badMove:     string;
  bestMove:    string;
  evalBefore:  number;
  evalAfter:   number;
  pvBest:      string;
  pvBad:       string;
  playerColor: 'white' | 'black';
  moveNumber:  number;
}

const SYSTEM_PROMPT =
  'You are a chess coach reviewing a specific move from a student\'s game. ' +
  'Respond with ONLY the chess explanation — no greetings, no preamble, no sign-off. ' +
  'Start your response immediately with the chess content. ' +
  'Write 3-5 sentences in plain conversational prose. ' +
  'Explain why the move was bad, what was missed, and why the better move is stronger. ' +
  'Be direct, concise, and instructive.';

export async function explainBlunder(params: BlunderExplainParams): Promise<string> {
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();

  if (!apiKey) {
    return 'AI explanations are not configured. Add VITE_GEMINI_API_KEY to your .env file and restart the dev server.';
  }

  const { fen, badMove, bestMove, evalBefore, evalAfter, pvBest, pvBad, playerColor, moveNumber } = params;
  const swing = Math.abs(evalAfter - evalBefore);

  const userPrompt = `Position (FEN): ${fen}
Move played: ${badMove} (move ${moveNumber}, ${playerColor})
Better move: ${bestMove}
Evaluation swing: ${swing} centipawns lost (before: ${evalBefore}, after: ${evalAfter})

Without any greeting or preamble, explain directly:
- Why ${badMove} is a bad move in this position
- What tactical or positional concept was missed
- Why ${bestMove} is the stronger choice`;

  const body = {
    contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }] }],
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.4,
    },
  };

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      return 'Rate limit reached. Please wait a moment before requesting another explanation.';
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
      // Trim to last complete sentence so we never show a mid-word cutoff
      const lastPeriod = Math.max(
        text.lastIndexOf('. '),
        text.lastIndexOf('! '),
        text.lastIndexOf('? '),
      );
      const trimmed = lastPeriod > 0 ? text.slice(0, lastPeriod + 1) : text;
      return trimmed.trim();
    }

    return text.trim();
  } catch {
    return 'Unable to generate explanation. Please try again.';
  }
}
