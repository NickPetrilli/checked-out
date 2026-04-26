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
  'You are a chess coach reviewing a student\'s game. You give clear, encouraging, and instructive feedback. ' +
  'You always explain chess concepts in simple terms without assuming advanced knowledge. ' +
  'Keep your explanation to 4-6 sentences maximum. ' +
  'Do not use bullet points — write in natural flowing prose as if you are speaking to the student directly.';

export async function explainBlunder(params: BlunderExplainParams): Promise<string> {
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();

  if (!apiKey) {
    return 'AI explanations are not configured. Add VITE_GEMINI_API_KEY to your .env file and restart the dev server.';
  }

  const { fen, badMove, bestMove, evalBefore, evalAfter, pvBest, pvBad, playerColor, moveNumber } = params;
  const swing = Math.abs(evalAfter - evalBefore);

  const userPrompt = `You are a chess coach.

Position (FEN): ${fen}
Player move: ${badMove} (Move ${moveNumber} for ${playerColor})
Best move: ${bestMove}
Evaluation before: ${evalBefore} centipawns
Evaluation after player's move: ${evalAfter} centipawns
Evaluation swing: ${swing} centipawns lost

Engine line after best move: ${pvBest || '(not available)'}
Engine line after player's move: ${pvBad || '(not available)'}

Explain:
1. Why the player's move is a mistake or blunder
2. What tactical or positional idea was missed
3. Why the best move is stronger
4. Keep the explanation simple, conversational, and encouraging`;

  const body = {
    contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }] }],
    generationConfig: {
      maxOutputTokens: 300,
      temperature: 0.7,
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
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
    return text.trim();
  } catch {
    return 'Unable to generate explanation. Please try again.';
  }
}
