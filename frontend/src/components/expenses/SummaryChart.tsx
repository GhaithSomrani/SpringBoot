import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { CategoryDto } from '@/api/categories';
import type { ExpenseSummaryDto } from '@/api/expenses';
import { Skeleton } from '@/components/ui/skeleton';

const FALLBACK_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
];

interface Props {
  summary: ExpenseSummaryDto | undefined;
  categories: CategoryDto[];
  isLoading: boolean;
}

export function SummaryChart({ summary, categories, isLoading }: Props) {
  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (!summary || Object.keys(summary.byCategory).length === 0) {
    return null;
  }

  const data = Object.entries(summary.byCategory)
    .filter(([, v]) => v > 0)
    .map(([categoryId, total], i) => {
      const cat = categories.find((c) => c.id === categoryId);
      return {
        name: cat?.name ?? categoryId,
        value: total,
        color: cat?.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      };
    });

  if (data.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-border p-4">
      <p className="mb-3 text-sm font-medium text-foreground">
        Spending by category
        <span className="ml-2 text-muted-foreground font-normal">
          ${summary.totalAmount.toFixed(2)} total
        </span>
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--popover)',
              color: 'var(--popover-foreground)',
              fontSize: '12px',
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '12px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
