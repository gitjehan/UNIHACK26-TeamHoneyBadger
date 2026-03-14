import { memo } from 'react';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, YAxis } from 'recharts';

interface TimelinePoint {
  timestamp: number;
  posture: number;
  focus: number;
  stress: number;
}

interface SessionTimelineProps {
  data: TimelinePoint[];
  expanded?: boolean;
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
  expanded = false,
}: {
  data: TimelinePoint[];
  dataKey: string;
  label: string;
  color: string;
  expanded?: boolean;
}) {
  const latest = data.length > 0 ? Math.round(data[data.length - 1][dataKey as keyof TimelinePoint] as number) : 0;
  const gradientId = `spark-${dataKey}`;
  const chartHeight = expanded ? 72 : 32;

  return (
    <div className="timeline-row">
      <span className="timeline-row-label">{label}</span>

      <div className="timeline-row-chart" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={expanded ? 0.25 : 0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {expanded && <YAxis domain={[0, 100]} hide />}
            {expanded && <ReferenceLine y={70} stroke={color} strokeDasharray="3 3" strokeOpacity={0.3} />}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={expanded ? 2 : 1.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={false}
              baseLine={0}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <span className="timeline-row-value" style={{ color }}>
        {latest}
      </span>
    </div>
  );
}

export const SessionTimeline = memo(function SessionTimeline({ data, expanded = false }: SessionTimelineProps): JSX.Element {
  const cardClassName = `card session-timeline${expanded ? ' session-timeline--expanded' : ''}`;

  if (!data.length) {
    return (
      <div className={cardClassName}>
        <h3 className="session-timeline-title">Session Analytics</h3>
        <div className="timeline timeline--loading">Collecting data...</div>
      </div>
    );
  }

  return (
    <div className={cardClassName}>
      <h3 className="session-timeline-title">Session Analytics</h3>
      <div className={`session-timeline-body${expanded ? ' session-timeline-body--expanded' : ''}`}>
        {METRICS.map((m) => (
          <Sparkline key={m.key} data={data} dataKey={m.key} label={m.label} color={m.color} expanded={expanded} />
        ))}
      </div>
    </div>
  );
});
