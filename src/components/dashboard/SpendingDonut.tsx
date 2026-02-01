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
        <div className="glass rounded-lg px-3 py-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <span>{item.icon}</span>
            {item.name}
          </p>
          <p className="text-xs text-muted-foreground">{formatINR(item.value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative w-full h-52">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Spent</span>
        <span className="text-xl font-bold text-foreground">{formatINR(totalSpent)}</span>
      </div>
    </div>
  );
}
