import { useEffect, useRef, useState, type RefObject } from 'react';

export interface WebcamState {
  videoRef: RefObject<HTMLVideoElement | null>;
  ready: boolean;
  error: string | null;
}

export function useWebcam(enabled: boolean): WebcamState {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let stream: MediaStream | null = null;
    let cancelled = false;

    const run = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false,
        });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to access webcam');
        setReady(false);
      }
    };

    run();

    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((track) => track.stop());
      setReady(false);
    };
  }, [enabled]);

  return { videoRef, ready, error };
}
