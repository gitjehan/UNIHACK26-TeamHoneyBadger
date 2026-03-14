import { memo } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface TimelinePoint {
  timestamp: number;
  posture: number;
  focus: number;
  stress: number;
}

interface SessionTimelineProps {
  data: TimelinePoint[];
}

const METRICS: Array<{ key: keyof Omit<TimelinePoint, 'timestamp'>; label: string; color: string }> = [
  { key: 'posture', label: 'Posture', color: '#4A7C59' },
  { key: 'focus', label: 'Focus', color: '#6B9E7A' },
  { key: 'stress', label: 'Stress', color: '#C0392B' },
];

function Sparkline({
  data,
  dataKey,
  label,
  color,
}: {
  data: TimelinePoint[];
  dataKey: string;
  label: string;
  color: string;
}) {
  const latest = data.length > 0 ? Math.round(data[data.length - 1][dataKey as keyof TimelinePoint] as number) : 0;
  const gradientId = `spark-${dataKey}`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: '#A89B8C',
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {label}
      </span>

      <div style={{ flex: 1, height: 32, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={false}
              baseLine={0}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <span
        style={{
          fontSize: 18,
          fontWeight: 500,
          color,
          fontFamily: 'var(--font-display)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          minWidth: 24,
          textAlign: 'right',
        }}
      >
        {latest}
      </span>
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
      <div style={{ display: 'flex', gap: 16 }}>
        {METRICS.map((m) => (
          <Sparkline key={m.key} data={data} dataKey={m.key} label={m.label} color={m.color} />
        ))}
      </div>
    </div>
  );
});
