import { memo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface TimelinePoint {
  timestamp: number;
  posture: number;
  focus: number;
  stress: number;
}

interface SessionTimelineProps {
  data: TimelinePoint[];
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#fffdf8',
        border: '1px solid #e6e0d5',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        fontSize: 12,
      }}
    >
      <div style={{ color: '#9a8f84', marginBottom: 6, fontWeight: 600 }}>
        {label ? formatTime(label) : ''}
      </div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: entry.color, flexShrink: 0 }} />
          <span style={{ color: '#6b6158', textTransform: 'capitalize' }}>{entry.dataKey}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#2d2b28', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export const SessionTimeline = memo(function SessionTimeline({ data }: SessionTimelineProps): JSX.Element {
  if (!data.length) {
    return (
      <div className="card">
        <h3>Session Timeline</h3>
        <div
          className="timeline"
          style={{
            display: 'grid',
            placeItems: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 13,
          }}
        >
          Collecting data...
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Session Timeline</h3>
      <div style={{ display: 'flex', gap: 14, marginBottom: 4 }}>
        <Legend color="#3D6B4F" label="Posture" />
        <Legend color="#5A8A6B" label="Focus" />
        <Legend color="#B85A4D" label="Stress" />
      </div>
      <div className="timeline">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="gradPosture" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3D6B4F" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#3D6B4F" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradFocus" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5A8A6B" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#5A8A6B" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradStress" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#B85A4D" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#B85A4D" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4dfd5" strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              tick={{ fontSize: 10, fill: '#9a8f84' }}
              axisLine={false}
              tickLine={false}
              minTickGap={60}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#9a8f84' }}
              axisLine={false}
              tickLine={false}
              tickCount={3}
            />
            <ReferenceLine y={65} stroke="#3D6B4F" strokeDasharray="6 4" strokeOpacity={0.3} label="" />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="posture"
              stroke="#3D6B4F"
              strokeWidth={2}
              fill="url(#gradPosture)"
              isAnimationActive
              animationDuration={800}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: '#3D6B4F' }}
            />
            <Area
              type="monotone"
              dataKey="focus"
              stroke="#5A8A6B"
              strokeWidth={1.5}
              fill="url(#gradFocus)"
              isAnimationActive
              animationDuration={800}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: '#5A8A6B' }}
            />
            <Area
              type="monotone"
              dataKey="stress"
              stroke="#B85A4D"
              strokeWidth={1.5}
              fill="url(#gradStress)"
              isAnimationActive
              animationDuration={800}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: '#B85A4D' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
      <span style={{ fontSize: 11, color: '#6b6158' }}>{label}</span>
    </div>
  );
}
