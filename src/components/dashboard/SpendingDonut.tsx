import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { formatINR } from '@/lib/formatCurrency';

interface SpendingData {
  name: string;
  value: number;
  color: string;
  icon: string;
}

interface SpendingDonutProps {
  data: SpendingData[];
  totalSpent: number;
}

/** Allocation donut. The hole is the readout.
 *
 *  There is no floating tooltip: a cursor-following box over a donut lands on
 *  the centre the moment you hover the inner edge of the ring, which is exactly
 *  where the total is printed, so the two covered each other. The hovered slice
 *  reports itself in the hole instead, where there is already space reserved and
 *  nothing to collide with.
 */
export function SpendingDonut({ data, totalSpent }: SpendingDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const active = activeIndex === null ? null : (data[activeIndex] ?? null);
  const share = active && totalSpent > 0 ? (active.value / totalSpent) * 100 : 0;

  return (
    <div className="relative w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={68}
            outerRadius={95}
            paddingAngle={2}
            dataKey="value"
            stroke="hsl(var(--background))"
            strokeWidth={2}
            cornerRadius={0}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            // Touch has no hover, so a tap reports the slice too.
            onClick={(_, index) => setActiveIndex((cur) => (cur === index ? null : index))}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                // Solid, not a gradient: DESIGN.md rules gradients out, and an
                // alpha ramp dilutes a palette whose whole job is to be a
                // category's identity.
                fill={entry.color}
                opacity={activeIndex === null || activeIndex === index ? 1 : 0.35}
                style={{ transition: 'opacity 150ms ease-in-out', cursor: 'pointer' }}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-center px-14">
          {active ? (
            <>
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block truncate">
                {active.icon} {active.name}
              </span>
              <div className="text-xl font-bold text-foreground mt-1 currency-display">
                <span className="text-muted-foreground text-sm mr-0.5">₹</span>
                {formatINR(active.value).replace('₹', '')}
              </div>
              <span className="text-[10px] font-mono text-muted-foreground mt-0.5 block">
                {share.toFixed(share < 10 ? 1 : 0)}% of spend
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                Total Spent
              </span>
              <div className="text-xl font-bold text-foreground mt-1 currency-display">
                <span className="text-muted-foreground text-sm mr-0.5">₹</span>
                {formatINR(totalSpent).replace('₹', '')}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
