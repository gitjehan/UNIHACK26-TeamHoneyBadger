import { useEffect, useRef, useState, type RefObject } from 'react';

function describeWebcamError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') {
      return 'Camera permission denied. Open System Settings > Privacy & Security > Camera and enable access for this app.';
    }
    if (err.name === 'NotFoundError') {
      return 'No camera detected. Please connect a webcam and try again.';
    }
    if (err.name === 'NotReadableError' || err.name === 'AbortError') {
      return 'Camera is in use by another application. Close other apps using the camera and retry.';
    }
    if (err.name === 'OverconstrainedError') {
      return 'Camera does not support the required resolution. Try a different camera.';
    }
    if (err.name === 'SecurityError') {
      return 'Camera access blocked by security policy. Ensure you are running on HTTPS or localhost.';
    }
  }
  if (err instanceof Error) return err.message;
  return 'Unable to access webcam. Check your camera connection and permissions.';
}

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

    const run = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API not available — check browser permissions or use HTTPS');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
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

        setReady(true);
        setError(null);
      } catch (err) {
        setError(describeWebcamError(err));
        setReady(false);
      }
    };

    run();

    return () => {
      cancelled = true;
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
