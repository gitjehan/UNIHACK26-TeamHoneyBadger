import type { SessionRecap } from '@renderer/lib/types';
import { SessionRecapCard } from './SessionRecapCard';

interface RecapOverlayProps {
  recap: SessionRecap | null;
  onClose: () => void;
  onRecalibrate: () => void;
}

export function RecapOverlay({ recap, onClose, onRecalibrate }: RecapOverlayProps): JSX.Element | null {
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
      const filename = `kinetic-recap-${new Date().toISOString().slice(0, 10)}.png`;
      await window.kinetic.exportRecapPng(dataUrl, filename);
    } catch (err) {
      console.error('Failed to save recap image', err);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      {/* Stop click propagation so clicking the card doesn't close */}
      <div onClick={(e) => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease-out' }}>
        <SessionRecapCard recap={recap} onCopy={copy} onSave={save} onClose={onClose} onRecalibrate={onRecalibrate} />
      </div>
    </div>
  );
}
