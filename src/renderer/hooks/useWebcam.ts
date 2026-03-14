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
  ready: boolean;
  error: string | null;
}

export function useWebcam(enabled: boolean): WebcamState {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        if (videoRef.current) {
          if (videoRef.current.srcObject !== stream) videoRef.current.srcObject = stream;
          await videoRef.current.play();
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
      setReady(false);
    };
  }, [enabled]);

  return { videoRef, ready, error };
}
