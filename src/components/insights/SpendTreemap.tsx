import { useMemo, useState } from 'react';
import { Treemap, ResponsiveContainer } from 'recharts';
import { formatINRCompact } from '@/lib/formatCurrency';
import { assignColors, LONG_TAIL_COLOR, FOLD_LABEL } from '@/lib/categoryColors';

interface Slice {
  label: string;
  amount: number;
  count: number;
}

interface SpendTreemapProps {
  slices: Slice[];
  /** A cell below this share comes out too narrow to hold its own name, and an
   *  unnamed box is the legend problem again, so the tail folds instead. */
  minShare?: number;
}

interface FoldMember {
  label: string;
  amount: number;
}

interface CellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  label?: string;
  amount?: number;
  fill?: string;
  onEnter?: (label: string) => void;
  onLeave?: () => void;
}

// Area is the share, and the name sits inside the box, so there is nothing to
// correlate against a legend. A cell only gets text when it is big enough to
// hold it; below that the box speaks for itself and the row list carries the
// name.
function Cell({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  label = '',
  amount = 0,
  fill,
  onEnter,
  onLeave,
}: CellProps) {
  const roomForName = width > 62 && height > 26;
  const roomForAmount = width > 62 && height > 42;

  return (
    <g
      onMouseEnter={() => onEnter?.(label)}
      onMouseLeave={() => onLeave?.()}
      // Touch has no hover, and the fold is the one cell whose contents are
      // otherwise unreachable.
      onClick={() => onEnter?.(label)}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="hsl(var(--background))"
        strokeWidth={2}
        rx={3}
      />
      {roomForName && (
        <text
          x={x + 8}
          y={y + 17}
          fill="#241F18"
          fontSize={11}
          fontFamily="Satoshi, sans-serif"
          fontWeight={500}
        >
          {label.length > Math.floor(width / 7) ? `${label.slice(0, Math.floor(width / 7) - 1)}…` : label}
        </text>
      )}
      {roomForAmount && (
        <text
          x={x + 8}
          y={y + 33}
          fill="#241F18"
          fontSize={10.5}
          fontFamily="'IBM Plex Mono', monospace"
          opacity={0.75}
        >
          {formatINRCompact(amount)}
        </text>
      )}
    </g>
  );
}

export function SpendTreemap({ slices, minShare = 0.035 }: SpendTreemapProps) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const { data, foldMembers, total } = useMemo(() => {
    const sum = slices.reduce((s, x) => s + x.amount, 0);
    if (sum <= 0) return { data: [], foldMembers: [] as FoldMember[], total: 0 };

    const colors = assignColors(slices.map((s) => s.label));
    const ranked = [...slices].sort((a, b) => b.amount - a.amount);
    const kept = ranked.filter((s) => s.amount / sum >= minShare);
    const tail = ranked.filter((s) => s.amount / sum < minShare);

    const cells = kept.map((s) => ({
      label: s.label,
      amount: s.amount,
      fill: colors.get(s.label) ?? LONG_TAIL_COLOR,
    }));

    if (tail.length > 0) {
      cells.push({
        label: FOLD_LABEL,
        amount: tail.reduce((s, x) => s + x.amount, 0),
        fill: LONG_TAIL_COLOR,
      });
    }

    // What the fold swallowed, largest first. Kept rather than discarded: the
    // whole point of the fold is that these are too small to draw, which is not
    // the same as too small to name.
    return {
      data: cells,
      foldMembers: tail.map((t) => ({ label: t.label, amount: t.amount })),
      total: sum,
    };
  }, [slices, minShare]);

  if (data.length === 0) return null;

  const activeCell = activeLabel === null ? null : data.find((d) => d.label === activeLabel);
  const showingFold = activeLabel === FOLD_LABEL && foldMembers.length > 0;

  return (
    <div className="w-full">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="amount"
            aspectRatio={16 / 9}
            isAnimationActive={false}
            content={
              (
                <Cell onEnter={setActiveLabel} onLeave={() => setActiveLabel(null)} />
              ) as any
            }
          />
        </ResponsiveContainer>
      </div>

      {/* Fixed height so revealing the fold does not shove the page around. */}
      <div className="mt-2 min-h-[2.25rem] text-2xs leading-relaxed">
        {showingFold ? (
          <p className="text-muted-foreground">
            <span className="text-foreground">{FOLD_LABEL}</span> is{' '}
            {foldMembers.map((m, i) => (
              <span key={m.label}>
                {i > 0 && ' · '}
                <span className="text-foreground">{m.label}</span>{' '}
                <span className="amount">{formatINRCompact(m.amount)}</span>
              </span>
            ))}
          </p>
        ) : activeCell ? (
          <p className="text-muted-foreground">
            <span className="text-foreground">{activeCell.label}</span>{' '}
            <span className="amount">{formatINRCompact(activeCell.amount)}</span> ·{' '}
            {((activeCell.amount / total) * 100).toFixed(0)}% of the month
          </p>
        ) : foldMembers.length > 0 ? (
          <p className="text-muted-foreground">
            {FOLD_LABEL} groups {foldMembers.length} smaller items. Hover or tap a block to
            break it down.
          </p>
        ) : null}
      </div>
    </div>
  );
}
