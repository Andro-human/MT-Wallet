import { useMemo } from 'react';
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

interface CellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  label?: string;
  amount?: number;
  fill?: string;
}

// Area is the share, and the name sits inside the box, so there is nothing to
// correlate against a legend. A cell only gets text when it is big enough to
// hold it; below that the box speaks for itself and the row list carries the
// name.
function Cell({ x = 0, y = 0, width = 0, height = 0, label = '', amount = 0, fill }: CellProps) {
  const roomForName = width > 62 && height > 26;
  const roomForAmount = width > 62 && height > 42;

  return (
    <g>
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
  const data = useMemo(() => {
    const total = slices.reduce((s, x) => s + x.amount, 0);
    if (total <= 0) return [];

    const colors = assignColors(slices.map((s) => s.label));
    const ranked = [...slices].sort((a, b) => b.amount - a.amount);
    const kept = ranked.filter((s) => s.amount / total >= minShare);
    const tail = ranked.filter((s) => s.amount / total < minShare);

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
    return cells;
  }, [slices, minShare]);

  if (data.length === 0) return null;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data}
          dataKey="amount"
          aspectRatio={16 / 9}
          isAnimationActive={false}
          content={<Cell /> as any}
        />
      </ResponsiveContainer>
    </div>
  );
}
