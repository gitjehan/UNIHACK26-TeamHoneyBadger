import { memo, useEffect, useState } from 'react';

interface BreakReminderProps {
  visible: boolean;
  onDismiss: () => void;
}

export const BreakReminder = memo(function BreakReminder({
  visible,
  onDismiss,
}: BreakReminderProps): JSX.Element | null {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setShow(true), 50);
      return () => clearTimeout(timer);
    }
    setShow(false);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className={`break-reminder-backdrop ${show ? 'break-reminder-backdrop--visible' : ''}`}>
      <div className={`break-reminder-card ${show ? 'break-reminder-card--visible' : ''}`}>
        <svg className="break-reminder-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <p className="break-reminder-title">Rest your eyes</p>
        <p className="break-reminder-sub">Look 20 ft away for 20 seconds</p>
        <button className="break-reminder-btn" type="button" onClick={onDismiss}>
          Got it
        </button>
      </div>
    </div>
  );
});
