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
        <div className="glass-card px-3 py-2">
          <p className="text-sm font-semibold flex items-center gap-2">
            <span>{item.icon}</span>
            {item.name}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatINR(item.value)}</p>
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
            {data.map((entry, index) => (
              <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
              </linearGradient>
            ))}
          </defs>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={68}
            outerRadius={95}
            paddingAngle={4}
            dataKey="value"
            strokeWidth={0}
            cornerRadius={6}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={`url(#gradient-${index})`}
                style={{
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.2))',
                }}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Center content with glass effect */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="glass-card px-5 py-3 text-center">
          <span className="text-2xs text-muted-foreground uppercase tracking-extra-wide font-medium">
            Total Spent
          </span>
          <div className="text-xl font-bold text-foreground mt-0.5 currency-display">
            <span className="currency-symbol text-muted-foreground">₹</span>
            {formatINR(totalSpent).replace('₹', '')}
          </div>
        </div>
      </div>
    </div>
  );
}
