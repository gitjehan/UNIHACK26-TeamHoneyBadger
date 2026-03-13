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
              contentStyle={{ background: '#fffdf8', border: '1px solid #e6e0d5', borderRadius: 10 }}
              labelFormatter={(value) => new Date(Number(value)).toLocaleTimeString()}
            />
            <Area type="monotone" dataKey="posture" stroke="#4A7C59" fill="#4A7C5922" isAnimationActive={false} />
            <Area type="monotone" dataKey="focus" stroke="#5f8c77" fill="#5f8c7720" isAnimationActive={false} />
            <Area type="monotone" dataKey="stress" stroke="#B85A4D" fill="#B85A4D20" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
