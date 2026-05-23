
export function evalBarWhitePct(score: number): number {
  return Math.min(100, Math.max(0, 50 + score / 20));
}

export function formatEvalLabel(score: number): string {
  if (score >= 9_900)  return `M${10_000 - score}`;
  if (score <= -9_900) return `M${10_000 + score}`;
  if (Math.abs(score) < 20) return '0.0';
  const pawns = (Math.abs(score) / 100).toFixed(1);
  return score > 0 ? `+${pawns}` : `-${pawns}`;
}

export function EvalBar({ score }: { score: number | undefined }) {
  const pct      = evalBarWhitePct(score ?? 0);
  const rawScore = score ?? 0;
  const label    = score !== undefined ? formatEvalLabel(rawScore) : null;

  const labelTopPct = Math.max(5, Math.min(95, 100 - pct));

  return (
    <div
      role="meter"
      aria-label={`Position evaluation: ${label ?? '—'}`}
      aria-valuenow={rawScore}
      aria-valuemin={-1000}
      aria-valuemax={1000}
      style={{
        position: 'relative',
        width: 20,
        minHeight: 80,
        flexShrink: 0,
        alignSelf: 'stretch',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: 'var(--eval-bar-bg)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            flexGrow: 100 - pct,
            flexShrink: 0,
            flexBasis: 0,
            backgroundColor: 'var(--eval-black)',
            transition: 'flex-grow 0.3s ease',
          }}
        />
        <div
          style={{
            flexGrow: pct,
            flexShrink: 0,
            flexBasis: 0,
            backgroundColor: 'var(--eval-white)',
            transition: 'flex-grow 0.3s ease',
          }}
        />
      </div>

      {label !== null && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: `${labelTopPct}%`,
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            pointerEvents: 'none',
            backgroundColor: 'rgba(240, 217, 181, 0.92)',
            borderRadius: 2,
            padding: '1px 3px',
            whiteSpace: 'nowrap',
            transition: 'top 0.3s ease',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono, "Roboto Mono", monospace)',
              fontSize: 9,
              fontWeight: 700,
              color: '#1a1a1a',
              lineHeight: 1.3,
              letterSpacing: '-0.3px',
            }}
          >
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
