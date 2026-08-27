import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
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

export function SpendingDonut({ data, totalSpent }: SpendingDonutProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="neo-card px-3 py-2 bg-background border-border shadow-md">
          <p className="text-xs font-bold font-mono uppercase tracking-wide flex items-center gap-2 text-muted-foreground">
            <span>{item.icon}</span>
            {item.name}
          </p>
          <p className="text-sm font-bold text-foreground mt-0.5">{formatINR(item.value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {/* Simple solid colors or subtle gradients, avoiding glossy looks */}
            {data.map((entry, index) => (
              <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={entry.color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={entry.color} stopOpacity={0.6} />
              </linearGradient>
            ))}
          </defs>
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
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={`url(#gradient-${index})`}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-center">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            Total Spent
          </span>
          <div className="text-xl font-bold text-foreground mt-1 currency-display">
            <span className="text-muted-foreground text-sm mr-0.5">₹</span>
            {formatINR(totalSpent).replace('₹', '')}
          </div>
        </div>
      </div>
    </div>
  );
}
