import type { SessionRecap } from '@renderer/lib/types';
import { SessionRecapCard } from './SessionRecapCard';

interface RecapOverlayProps {
  recap: SessionRecap | null;
  onClose: () => void;
}

export function RecapOverlay({ recap, onClose }: RecapOverlayProps): JSX.Element | null {
  if (!recap) return null;

  const copy = async (dataUrl: string) => {
    await window.kinetic.copyRecapToClipboard(dataUrl);
  };

  const save = async (dataUrl: string) => {
    const filename = `kinetic-recap-${new Date().toISOString().slice(0, 10)}.png`;
    await window.kinetic.exportRecapPng(dataUrl, filename);
  };

  return (
    <div className="overlay">
      <SessionRecapCard recap={recap} onCopy={copy} onSave={save} onClose={onClose} />
    </div>
  );
}
