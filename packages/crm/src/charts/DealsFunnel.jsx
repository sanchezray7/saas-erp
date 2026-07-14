import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'

export function DealsFunnel({ data = [] }) {
  if (data.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={Math.max(150, data.length * 48)}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 60, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7a90' }} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: '#12263f' }}
          width={120}
        />
        <Tooltip
          formatter={(_, name, props) => {
            if (name === 'count') return [`${props.payload.count} deals`, 'Cantidad']
            return [`$${props.payload.value.toLocaleString()}`, 'Valor']
          }}
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid var(--border)' }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} fillOpacity={0.3 + 0.7 * (entry.probability / 100)} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v) => `$${v.toLocaleString()}`}
            style={{ fontSize: 11, fill: '#6b7a90' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
