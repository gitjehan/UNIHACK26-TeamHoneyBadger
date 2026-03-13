import { useEffect, useRef, useState, type RefObject } from 'react';

export interface WebcamState {
  videoRef: RefObject<HTMLVideoElement | null>;
  processingVideoRef: RefObject<HTMLVideoElement | null>;
  ready: boolean;
  error: string | null;
}

export function useWebcam(enabled: boolean): WebcamState {
  const videoRef = useRef<HTMLVideoElement>(null);
  const processingVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureProcessingVideo = (): HTMLVideoElement | null => {
    if (processingVideoRef.current) return processingVideoRef.current;
    if (typeof document === 'undefined') return null;
    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    processingVideoRef.current = video;
    return video;
  };

  const attachStream = async (video: HTMLVideoElement, stream: MediaStream) => {
    if (video.srcObject !== stream) video.srcObject = stream;
    await video.play();
  };

  useEffect(() => {
    if (!enabled) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setReady(false);
      return;
    }

    let cancelled = false;
    let syncTimer: ReturnType<typeof setInterval> | null = null;

    const run = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const processing = ensureProcessingVideo();
        if (!processing) throw new Error('Unable to create internal video pipeline');
        await attachStream(processing, stream);

        if (videoRef.current) {
          await attachStream(videoRef.current, stream);
        }

        syncTimer = setInterval(() => {
          const display = videoRef.current;
          const activeStream = streamRef.current;
          if (!display || !activeStream) return;
          if (display.srcObject !== activeStream) {
            attachStream(display, activeStream).catch((error) => {
              console.warn('Display webcam sync failed', error);
            });
          }
        }, 300);

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
      if (syncTimer) clearInterval(syncTimer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      if (processingVideoRef.current) processingVideoRef.current.srcObject = null;
      setReady(false);
    };
  }, [enabled]);

  return { videoRef, processingVideoRef, ready, error };
}
