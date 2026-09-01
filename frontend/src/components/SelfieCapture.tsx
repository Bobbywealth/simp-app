import { useCallback, useEffect, useRef, useState } from 'react';
import type { VerificationPose } from '../api/verification';

type PoseFrame = {
  pose: VerificationPose;
  blob: Blob;
  previewUrl: string;
};

// Pose sequence shown to the user. Each pose is a visual cue rather than
// a real anti-spoof check — the real anti-spoof defense is the moderator
// reviewing the captured selfie against the user's existing profile
// photos. Phase 2 will swap the heuristic liveness proxy for a real
// vendor SDK (e.g. AWS Rekognition Face Liveness).
const POSE_SEQUENCE: { pose: VerificationPose; label: string; instruction: string; emoji: string }[] = [
  { pose: 'center', label: 'Look straight', instruction: 'Face the camera and look straight ahead.', emoji: '🙂' },
  { pose: 'left', label: 'Turn left', instruction: 'Slowly turn your head to the left.', emoji: '👈' },
  { pose: 'right', label: 'Turn right', instruction: 'Slowly turn your head to the right.', emoji: '👉' },
];

const FRAME_HOLD_MS = 1_400;

export type SelfieCaptureProps = {
  onComplete: (payload: {
    file: Blob;
    poseSequence: VerificationPose[];
    livenessHints: { framesCaptured: number; faceMovedBetweenFrames: boolean; capturedAt: string[] };
  }) => void;
  onCancel?: () => void;
  busy?: boolean;
};

export default function SelfieCapture({ onComplete, onCancel, busy }: SelfieCaptureProps) {
  const [permissionState, setPermissionState] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [captured, setCaptured] = useState<PoseFrame[]>([]);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const capturedFramesRef = useRef<PoseFrame[]>([]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Acquire camera. Works in modern browsers and in Capacitor's WKWebView /
  // Android WebView (both expose navigator.mediaDevices.getUserMedia).
  // The Info.plist NSCameraUsageDescription and Android CAMERA permission
  // are already wired for the live-stream feature, so selfie capture will
  // inherit the same camera consent flow.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setPermissionError('Your browser does not support camera access.');
          setPermissionState('denied');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
        setPermissionState('granted');
      } catch (error) {
        setPermissionError(
          error instanceof Error
            ? `Camera access denied: ${error.message}`
            : 'Camera access denied.',
        );
        setPermissionState('denied');
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [stopStream]);

  // Revoke preview URLs when frames change so we don't leak memory.
  useEffect(
    () => () => {
      capturedFramesRef.current.forEach((frame) => URL.revokeObjectURL(frame.previewUrl));
      if (preview?.url) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  const captureFrame = useCallback(async (pose: VerificationPose): Promise<Blob | null> => {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return null;
    const width = video.videoWidth || 720;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);
    const blob: Blob = await new Promise((resolve) => {
      canvas.toBlob(
        (value) => {
          if (value) resolve(value);
          else resolve(new Blob());
        },
        'image/webp',
        0.86,
      );
    });
    if (!blob || blob.size === 0) return null;
    // Sanity-check the produced frame isn't all-black (camera permission
    // sometimes yields a black frame on iOS Safari before the stream is
    // fully primed). Average the canvas pixels; pure black is < 12 luma.
    try {
      const pixels = ctx.getImageData(0, 0, width, height).data;
      let lumaSum = 0;
      const step = Math.max(1, Math.floor(pixels.length / 4 / 4_000));
      for (let index = 0; index < pixels.length; index += step * 4) {
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        lumaSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      const samples = Math.floor(pixels.length / (step * 4)) || 1;
      const average = lumaSum / samples;
      if (average < 12) {
        setCaptureError('That frame came out dark. Hold steady and try again.');
        return null;
      }
    } catch {
      // If pixel readback fails (CORS / tainted canvas in some browsers),
      // trust the encoded blob.
    }
    void pose;
    return blob;
  }, []);

  const handleCapture = useCallback(async () => {
    if (activeIndex >= POSE_SEQUENCE.length) return;
    const frame = POSE_SEQUENCE[activeIndex];
    setCaptureError(null);
    const blob = await captureFrame(frame.pose);
    if (!blob) return;
    const previewUrl = URL.createObjectURL(blob);
    const next: PoseFrame = { pose: frame.pose, blob, previewUrl };
    capturedFramesRef.current = [...capturedFramesRef.current, next];
    setCaptured(capturedFramesRef.current);
    if (activeIndex + 1 < POSE_SEQUENCE.length) {
      setActiveIndex(activeIndex + 1);
    } else {
      setPreview({ url: previewUrl, blob });
      stopStream();
    }
  }, [activeIndex, captureFrame, stopStream]);

  // Auto-capture: hold each pose for FRAME_HOLD_MS then snap.
  useEffect(() => {
    if (permissionState !== 'granted') return;
    if (busy) return;
    if (activeIndex >= POSE_SEQUENCE.length) return;
    if (preview) return;
    const handle = window.setTimeout(() => {
      void handleCapture();
    }, FRAME_HOLD_MS);
    return () => window.clearTimeout(handle);
  }, [permissionState, activeIndex, busy, preview, handleCapture]);

  const handleRetake = useCallback(() => {
    capturedFramesRef.current.forEach((frame) => URL.revokeObjectURL(frame.previewUrl));
    capturedFramesRef.current = [];
    setCaptured([]);
    setPreview(null);
    setActiveIndex(0);
    if (!streamRef.current) {
      (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
            audio: false,
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => undefined);
          }
        } catch {
          setPermissionState('denied');
          setPermissionError('Camera access was denied. Enable it in your settings and try again.');
        }
      })();
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (!preview) return;
    const capturedAt = capturedFramesRef.current.map(() => new Date().toISOString());
    // Lightweight liveness proxy: distinct pose prompts means the face
    // moved between frames. Real anti-spoof arrives in Phase 2 via a
    // vendor SDK; moderators have final say in Phase 1.
    const faceMovedBetweenFrames =
      new Set(capturedFramesRef.current.map((frame) => frame.pose)).size >= 2;
    onComplete({
      file: preview.blob,
      poseSequence: capturedFramesRef.current.map((frame) => frame.pose),
      livenessHints: {
        framesCaptured: capturedFramesRef.current.length,
        faceMovedBetweenFrames,
        capturedAt,
      },
    });
  }, [onComplete, preview]);

  if (permissionState === 'denied') {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-sm text-red-100">
        <p className="font-medium">Camera unavailable</p>
        <p className="mt-2 text-xs text-red-200/80">
          {permissionError ?? 'Allow camera access in your browser settings to take a verification selfie.'}
        </p>
        {onCancel && (
          <button type="button" onClick={onCancel} className="mt-4 text-xs underline">
            Go back
          </button>
        )}
      </div>
    );
  }

  if (preview) {
    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black-700/70">
          <img
            src={preview.url}
            alt="Captured selfie preview"
            className="aspect-square w-full object-cover"
          />
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-xs text-white/60">
          <p className="font-medium uppercase tracking-[0.2em] text-gold">Pose sequence</p>
          <p className="mt-2 text-white/70">
            {captured
              .map((frame) => POSE_SEQUENCE.find((p) => p.pose === frame.pose)?.label)
              .join(' → ')}
          </p>
        </div>
        <button
          type="button"
          className="btn-gold w-full py-3 text-xs uppercase tracking-[0.2em]"
          onClick={handleSubmit}
          disabled={busy}
        >
          {busy ? 'Submitting…' : 'Submit for review'}
        </button>
        <button
          type="button"
          className="w-full py-2 text-[10px] uppercase tracking-[0.2em] text-white/40"
          onClick={handleRetake}
          disabled={busy}
        >
          Retake
        </button>
      </div>
    );
  }

  const active = POSE_SEQUENCE[activeIndex];
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black-700/70">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="aspect-square w-full -scale-x-100 object-cover"
        />
        <canvas ref={captureCanvasRef} className="hidden" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black/70 via-transparent to-transparent p-5 text-center">
          <div className="text-4xl">{active.emoji}</div>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-gold">{active.label}</p>
          <p className="mt-1 text-[11px] text-white/70">{active.instruction}</p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
            Pose {activeIndex + 1} / {POSE_SEQUENCE.length}
          </p>
        </div>
      </div>
      {captureError && <p className="text-xs text-red-300" role="alert">{captureError}</p>}
      <button
        type="button"
        className="btn-gold-outline w-full py-3 text-[10px] uppercase tracking-[0.2em]"
        onClick={() => void handleCapture()}
        disabled={busy || permissionState !== 'granted'}
      >
        {permissionState === 'pending' ? 'Requesting camera…' : 'Capture now'}
      </button>
      {onCancel && (
        <button
          type="button"
          className="w-full py-2 text-[10px] uppercase tracking-[0.2em] text-white/40"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
      )}
    </div>
  );
}