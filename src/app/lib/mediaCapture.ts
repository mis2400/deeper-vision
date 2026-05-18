// mediaCapture — shared photo + voice memo helpers for field capture.
//
// V1 4D Site Walk and downstream surfaces (4M Commissioning, attachments)
// share these helpers so every capture is downscaled the same way and
// every voice memo lifecycle reports the same operator-facing state.
//
// Honesty contract: every browser failure path maps to a clear operator
// message. We never silently swallow a "denied" / "unsupported" / device
// busy condition. Async lifecycles are unmount-safe — a sheet closing
// mid-photo or mid-recording stops the work and frees the device.

import { useCallback, useEffect, useRef, useState } from 'react';

// Hard cap on voice memo duration so a backgrounded tab can't record
// indefinitely. Five minutes is well past the longest realistic
// site-walk voice note.
const MAX_RECORDING_MS = 5 * 60 * 1000;

// ─────────────────────────── Photo downscale ──────────────────────
// Mobile photos are 5-12 MB raw. Browsers cap localStorage around
// 5-10 MB total, so we MUST downscale before persisting. Result is a
// JPEG data URL no larger than `maxDim` on its longer edge, with
// quality `quality` (0..1). Returns both the data URL and approx
// byte count for the storage meter.
export interface DownscaledPhoto {
  dataUrl: string;
  bytes: number;
  width: number;
  height: number;
}

export interface DownscaleOpts {
  /** Longer edge cap in pixels. Defaults to 1280. */
  maxDim?: number;
  /** JPEG quality 0..1. Defaults to 0.78. */
  quality?: number;
}

// Operator-facing error codes from downscalePhoto. The caller maps
// each to a fixed copy line — never surface raw err.message which can
// leak browser internals or confusing CORS / OOM diagnostics.
export type DownscaleErrorKind = 'unsupported-format' | 'decode-failed' | 'canvas-unavailable';
export class DownscaleError extends Error {
  constructor(public kind: DownscaleErrorKind, message: string) {
    super(message);
    this.name = 'DownscaleError';
  }
}

export async function downscalePhoto(file: File, opts: DownscaleOpts = {}): Promise<DownscaledPhoto> {
  const maxDim = opts.maxDim ?? 1280;
  const quality = opts.quality ?? 0.78;

  // Defense in depth: SVG is a valid <img> source but can carry script
  // tags. The canvas re-encode would strip them, but we refuse SVG
  // outright so a future "small-enough, skip re-encode" optimisation
  // can't reintroduce the hole. HEIC is rejected here too with a clear
  // message — Safari can decode it sometimes, but the behaviour is
  // version-dependent and the operator-facing copy is the same.
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('image/svg')) {
    throw new DownscaleError('unsupported-format', 'SVG files are not allowed for site walk captures.');
  }
  if (type === 'image/heic' || type === 'image/heif') {
    throw new DownscaleError('unsupported-format', 'Convert HEIC to JPEG before uploading.');
  }

  const sourceUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(sourceUrl);
    const { width, height } = clampDimensions(img.naturalWidth, img.naturalHeight, maxDim);
    if (!width || !height) {
      throw new DownscaleError('decode-failed', 'That photo did not decode properly.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new DownscaleError('canvas-unavailable', 'Could not prepare an image canvas in this browser.');
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return { dataUrl, bytes: approxDataUrlBytes(dataUrl), width, height };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new DownscaleError('decode-failed', 'That file did not decode as an image.'));
    img.src = src;
  });
}

function clampDimensions(w: number, h: number, maxDim: number): { width: number; height: number } {
  if (w <= maxDim && h <= maxDim) return { width: w, height: h };
  const ratio = w >= h ? maxDim / w : maxDim / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

/** Approximate byte size of a base64 data URL. Strips the prefix and
 *  reverses the 4 base64 chars → 3 bytes ratio. Off by 1-2 bytes due to
 *  padding which is fine for a storage meter. */
export function approxDataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

// ─────────────────────────── Byte + time formatters ───────────────
export function bytesLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

// ─────────────────────────── Voice recorder ───────────────────────
// MediaRecorder API wrapper. Picks the first supported MIME type from
// a known-good list (Safari prefers audio/mp4; Chrome / Firefox use
// audio/webm). On stop, returns a base64 data URL the caller can drop
// straight into store state. Live duration ticks every 250ms so the UI
// can show a count-up timer.

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'finalising' | 'denied' | 'unsupported' | 'error';

export interface RecorderResult {
  dataUrl: string;
  bytes: number;
  durationMs: number;
  mimeType: string;
}

export interface VoiceRecorder {
  state: RecorderState;
  /** Live ms elapsed while recording (0 when idle). */
  elapsedMs: number;
  /** Last finalised recording, cleared on next start. */
  result: RecorderResult | null;
  /** Honest operator copy when state is denied / unsupported / error. */
  errorMessage: string | null;
  /** Whether the browser exposes MediaRecorder + getUserMedia. */
  supported: boolean;
  start: () => Promise<void>;
  /** Stop and resolve with the finalised result (or null on error). */
  stop: () => Promise<RecorderResult | null>;
  reset: () => void;
}

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

export function useVoiceRecorder(): VoiceRecorder {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<RecorderResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const autoStopTimeoutRef = useRef<number | null>(null);
  const finalResolveRef = useRef<((res: RecorderResult | null) => void) | null>(null);
  // Stays true while the hook's host is mounted. Async paths consult it
  // before doing setState or assigning long-lived refs so a sheet that
  // closes during permission prompt / encode does not strand a stream.
  const aliveRef = useRef(true);

  const supported = typeof window !== 'undefined'
    && typeof window.MediaRecorder === 'function'
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === 'function';

  const stopTimer = () => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (autoStopTimeoutRef.current != null) {
      window.clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
  };

  const releaseStream = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
  };

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopTimer();
      // Best-effort stop so onstop can flush; if the recorder is mid
      // tear-down already this throws and we fall through to track stop.
      try { recorderRef.current?.stop(); } catch { /* ignore */ }
      releaseStream();
      // Resolve any in-flight stop() awaiters with null so callers don't
      // hang forever on a closed sheet.
      finalResolveRef.current?.(null);
      finalResolveRef.current = null;
    };
  }, []);

  const start = useCallback(async () => {
    if (!supported) {
      if (!aliveRef.current) return;
      setState('unsupported');
      setErrorMessage('This browser does not support voice recording. Try Safari or Chrome.');
      return;
    }
    let stream: MediaStream | null = null;
    try {
      if (!aliveRef.current) return;
      setErrorMessage(null);
      setResult(null);
      setElapsedMs(0);
      setState('requesting');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Sheet closed during permission prompt — stop tracks and bail
      // before assigning refs.
      if (!aliveRef.current) {
        for (const t of stream.getTracks()) t.stop();
        return;
      }

      streamRef.current = stream;

      const mimeType = MIME_CANDIDATES.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) ?? '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onerror = () => {
        if (aliveRef.current) {
          setState('error');
          setErrorMessage('Recording failed mid stream. Try again.');
        }
        stopTimer();
        releaseStream();
        finalResolveRef.current?.(null);
        finalResolveRef.current = null;
      };
      recorder.onstop = async () => {
        let payload: RecorderResult | null = null;
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          const dataUrl = await blobToDataUrl(blob);
          const durationMs = Date.now() - startedAtRef.current;
          payload = { dataUrl, bytes: blob.size, durationMs, mimeType: blob.type };
          if (aliveRef.current) {
            setResult(payload);
            setState('idle');
          }
        } catch (err) {
          console.error('Recorder onstop', err);
          if (aliveRef.current) {
            setState('error');
            setErrorMessage('Could not finalise the recording.');
          }
          payload = null;
        } finally {
          finalResolveRef.current?.(payload);
          finalResolveRef.current = null;
          stopTimer();
          releaseStream();
        }
      };

      startedAtRef.current = Date.now();
      recorder.start();
      if (aliveRef.current) setState('recording');
      tickRef.current = window.setInterval(() => {
        if (!aliveRef.current) return;
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 250);
      // Hard cap on length so a backgrounded tab can't run away.
      autoStopTimeoutRef.current = window.setTimeout(() => {
        try { recorderRef.current?.stop(); } catch { /* ignore */ }
      }, MAX_RECORDING_MS);
    } catch (err: any) {
      // Stop any partially-acquired stream before bailing.
      if (stream && stream !== streamRef.current) {
        for (const t of stream.getTracks()) t.stop();
      }
      if (!aliveRef.current) {
        releaseStream();
        return;
      }
      // getUserMedia rejects with a DOMException; map to honest copy.
      const name = err?.name ?? '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setState('denied');
        setErrorMessage('Microphone access was denied. Allow it in your browser settings to record voice notes.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setState('error');
        setErrorMessage('No microphone is available on this device.');
      } else if (name === 'NotReadableError') {
        setState('error');
        setErrorMessage('The microphone is in use by another app.');
      } else {
        setState('error');
        setErrorMessage('Could not start recording. Check microphone permissions.');
      }
      releaseStream();
    }
  }, [supported]);

  const stop = useCallback((): Promise<RecorderResult | null> => {
    // Reentrance guard: if a stop is already pending, return the same
    // promise so a double-tap can't strand the first awaiter.
    if (finalResolveRef.current) {
      return new Promise<RecorderResult | null>((resolve) => {
        const prev = finalResolveRef.current!;
        finalResolveRef.current = (res) => { prev(res); resolve(res); };
      });
    }
    if (state !== 'recording' || !recorderRef.current) {
      // Honest no-op: caller awaits and gets the last result (which may
      // be null if there was never one).
      return Promise.resolve(result);
    }
    if (aliveRef.current) setState('finalising');
    stopTimer();
    return new Promise<RecorderResult | null>((resolve) => {
      finalResolveRef.current = resolve;
      try {
        recorderRef.current?.stop();
      } catch {
        finalResolveRef.current = null;
        resolve(null);
      }
    });
  }, [state, result]);

  const reset = useCallback(() => {
    if (!aliveRef.current) return;
    setResult(null);
    setElapsedMs(0);
    setErrorMessage(null);
    setState('idle');
  }, []);

  return { state, elapsedMs, result, errorMessage, supported, start, stop, reset };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Could not encode the recording.'));
    reader.readAsDataURL(blob);
  });
}
