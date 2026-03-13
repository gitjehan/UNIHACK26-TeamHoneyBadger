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
    await window.kinetic.copyRecapToClipboard(dataUrl);
  };

  const save = async (dataUrl: string) => {
    const filename = `kinetic-recap-${new Date().toISOString().slice(0, 10)}.png`;
    await window.kinetic.exportRecapPng(dataUrl, filename);
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
