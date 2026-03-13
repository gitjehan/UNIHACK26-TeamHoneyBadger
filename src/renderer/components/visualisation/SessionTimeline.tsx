import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface TimelinePoint {
  timestamp: number;
  posture: number;
  focus: number;
  stress: number;
}

interface SessionTimelineProps {
  data: TimelinePoint[];
}

export function SessionTimeline({ data }: SessionTimelineProps): JSX.Element {
  return (
    <div className="card">
      <h3>Session Timeline</h3>
      <div className="timeline">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <XAxis hide dataKey="timestamp" />
            <YAxis hide domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: '#11161f', border: '1px solid #253040', borderRadius: 10 }}
              labelFormatter={(value) => new Date(Number(value)).toLocaleTimeString()}
            />
            <Area type="monotone" dataKey="posture" stroke="#4A7C59" fill="#4A7C5922" isAnimationActive={false} />
            <Area type="monotone" dataKey="focus" stroke="#8CD3B0" fill="#8CD3B022" isAnimationActive={false} />
            <Area type="monotone" dataKey="stress" stroke="#C0392B" fill="#C0392B22" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
