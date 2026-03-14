import { memo, useState, useEffect, useRef, useCallback } from 'react';

type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

const MODE_DURATIONS: Record<TimerMode, number> = {
  focus: 1500,
  shortBreak: 300,
  longBreak: 900,
};

const MODE_LABELS: Record<TimerMode, string> = {
  focus: 'Focus',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

const MODE_COLORS: Record<TimerMode, string> = {
  focus: '#D4908A',
  shortBreak: '#7BA68A',
  longBreak: '#8A9EB5',
};

interface PomodoroTimerProps {
  postureScore: number;
}

export const PomodoroTimer = memo(function PomodoroTimer({ postureScore }: PomodoroTimerProps) {
  const [mode, setMode] = useState<TimerMode>('focus');
  const [timeRemaining, setTimeRemaining] = useState(MODE_DURATIONS.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [completedRounds, setCompletedRounds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear interval helper
  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Switch mode and reset
  const switchMode = useCallback(
    (newMode: TimerMode) => {
      clearTimer();
      setIsRunning(false);
      setMode(newMode);
      setTimeRemaining(MODE_DURATIONS[newMode]);
    },
    [clearTimer],
  );

  // Timer tick effect
  useEffect(() => {
    if (!isRunning) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Timer finished
          clearTimer();
          setIsRunning(false);

          setCompletedRounds(rounds => {
            const newRounds = mode === 'focus' ? rounds + 1 : rounds;

            if (mode === 'focus') {
              const nextBreak = newRounds >= 4 ? 'longBreak' : 'shortBreak';
              setMode(nextBreak);
              setTimeRemaining(MODE_DURATIONS[nextBreak]);
              return newRounds;
            } else {
              setMode('focus');
              setTimeRemaining(MODE_DURATIONS.focus);
              return mode === 'longBreak' ? 0 : rounds;
            }
          });

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [isRunning, mode, clearTimer]);

  // Reset to current mode duration
  const handleReset = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    setTimeRemaining(MODE_DURATIONS[mode]);
  }, [mode, clearTimer]);

  const handleToggle = useCallback(() => {
    setIsRunning(r => !r);
  }, []);

  // Computed values
  const totalDuration = MODE_DURATIONS[mode];
  const progress = timeRemaining / totalDuration;
  const cx = 100;
  const cy = 100;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  // Dot position at arc endpoint
  const angle = -Math.PI / 2 + 2 * Math.PI * progress;
  const dotX = cx + radius * Math.cos(angle);
  const dotY = cy + radius * Math.sin(angle);

  // Formatted time
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const showNudge = postureScore < 40 && mode === 'focus' && isRunning;
  const modeColor = MODE_COLORS[mode];

  return (
    <div className="card pomodoro-card">
      {/* Mode tabs */}
      <div className="pomodoro-tabs">
        {(['focus', 'shortBreak', 'longBreak'] as TimerMode[]).map(m => (
          <button
            key={m}
            className={`pomodoro-tab${mode === m ? ' active' : ''}`}
            style={mode === m ? { color: MODE_COLORS[m], borderColor: MODE_COLORS[m] } : undefined}
            onClick={() => switchMode(m)}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* SVG arc + countdown */}
      <div className="pomodoro-ring-container">
        <svg viewBox="0 0 200 200">
          {/* Track ring */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="#E8E4DC"
            strokeWidth={4}
          />
          {/* Progress arc */}
          <circle
            className="pomodoro-arc"
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={modeColor}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 100 100)"
          />
          {/* Endpoint dot */}
          {progress > 0 && (
            <circle cx={dotX} cy={dotY} r={6} fill={modeColor} />
          )}
        </svg>
        <div className="pomodoro-time">{formattedTime}</div>
      </div>

      {/* Controls */}
      <div className="pomodoro-controls">
        <button className="pomodoro-btn" style={{ borderColor: modeColor, color: modeColor }} onClick={handleToggle}>
          {isRunning ? '❚❚ Pause' : '▶ Start'}
        </button>
        <button className="pomodoro-btn pomodoro-btn-reset" style={{ color: modeColor }} onClick={handleReset}>
          ↺
        </button>
      </div>

      {/* Round dots */}
      <div className="pomodoro-rounds">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="pomodoro-round-dot"
            style={i < completedRounds ? { background: modeColor, borderColor: modeColor } : undefined}
          />
        ))}
      </div>

      {/* Posture nudge */}
      {showNudge && (
        <div className="pomodoro-nudge">Sit up — your posture is slipping</div>
      )}
    </div>
  );
});
