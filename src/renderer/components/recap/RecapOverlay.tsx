import { useEffect } from 'react';
import type { SessionRecap } from '@renderer/lib/types';
import { SessionRecapCard } from './SessionRecapCard';

interface RecapOverlayProps {
  recap: SessionRecap | null;
  onClose: () => void;
}

export function RecapOverlay({ recap, onClose }: RecapOverlayProps): JSX.Element | null {
  useEffect(() => {
    if (!recap) return;

    document.body.classList.add('overlay-open');

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      document.body.classList.remove('overlay-open');
      window.removeEventListener('keydown', handleKey);
    };
  }, [recap, onClose]);

  if (!recap) return null;

  const copy = async (dataUrl: string) => {
    try {
      await window.kinetic.copyRecapToClipboard(dataUrl);
    } catch (err) {
      console.error('Failed to copy recap to clipboard', err);
    }
  };

  const save = async (dataUrl: string) => {
    try {
      const filename = `axis-recap-${new Date().toISOString().slice(0, 10)}.png`;
      await window.kinetic.exportRecapPng(dataUrl, filename);
    } catch (err) {
      console.error('Failed to save recap image', err);
    }
  };

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Session Recap">
      {/* Stop click propagation so clicking the card doesn't close */}
      <div onClick={(e) => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease-out' }}>
        <SessionRecapCard recap={recap} onCopy={copy} onSave={save} onClose={onClose} />
      </div>
    </div>
  );
}
