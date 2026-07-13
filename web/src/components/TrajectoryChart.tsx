'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrajectoryPoint } from '@/lib/types';

export function TrajectoryChart({ data }: { data: TrajectoryPoint[] }) {
  if (!data?.length) {
    return (
      <div className="empty-chart">Not enough series history for a trajectory chart yet.</div>
    );
  }

  const chartData = data.map((p) => ({
    ...p,
    label: p.regatta.replace(/\s*\([^)]*\)\s*$/, '').slice(0, 18),
  }));

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis
            yAxisId="rank"
            orientation="left"
            reversed
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            width={36}
            label={{ value: 'Rank', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
          />
          <YAxis
            yAxisId="score"
            orientation="right"
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            width={40}
            label={{ value: 'Best-3', angle: 90, position: 'insideRight', style: { fontSize: 11 } }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid rgba(15,23,42,0.08)',
              boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
            }}
          />
          <Legend />
          <Line
            yAxisId="rank"
            type="monotone"
            dataKey="rank"
            name="National rank"
            stroke="#0f766e"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="score"
            type="monotone"
            dataKey="score"
            name="Best-3 score"
            stroke="#c2410c"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
