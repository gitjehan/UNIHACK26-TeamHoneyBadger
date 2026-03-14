import type { RefObject } from 'react';

interface WebcamFeedProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  poseFps: number;
  faceFps: number;
}

export function WebcamFeed({ videoRef, poseFps, faceFps }: WebcamFeedProps): JSX.Element {
  return (
    <div className="card" style={{ display: 'grid', gridTemplateRows: 'auto auto auto', gap: 10, overflow: 'hidden' }}>
      <h3>Webcam Feed</h3>
      <div
        style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'var(--bg-card-muted)',
          border: '1px solid var(--border-card)',
          aspectRatio: '4 / 3',
        }}
      >
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }}
          muted
          playsInline
          autoPlay
        />
      </div>
      <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        {poseFps} fps pose · {faceFps} fps face
      </div>
    </div>
  );
}
