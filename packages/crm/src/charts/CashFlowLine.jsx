import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export function CashFlowLine({ data = [] }) {
  if (data.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7a90' }} />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7a90' }}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Estimado']}
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid var(--border)' }}
        />
        <defs>
          <linearGradient id="cashFlowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2c7be5" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#2c7be5" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke="#2c7be5"
          strokeWidth={2}
          fill="url(#cashFlowGrad)"
          dot={{ r: 4, fill: '#2c7be5', strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#2c7be5', strokeWidth: 2, stroke: '#fff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
