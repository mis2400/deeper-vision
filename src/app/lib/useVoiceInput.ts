// useVoiceInput — Web Speech API wrapper for the AI Assistant.
//
// Browsers expose voice recognition as `webkitSpeechRecognition`
// (Chrome / Edge / Safari) or `SpeechRecognition` (spec). We pick
// whichever is available; if neither, the hook reports
// `supported: false` and the mic button hides.
//
// Honesty contract: every failure path maps to a one-line operator
// message instead of swallowing the error or showing a generic
// "Recognition error". The brief is explicit on this.

import { useCallback, useEffect, useRef, useState } from 'react';

// SpeechRecognition is not in the standard lib.dom types yet; type it
// loosely so we don't pull a polyfill just for the type.
type AnySpeechRecognition = any;

declare global {
  interface Window {
    SpeechRecognition?: AnySpeechRecognition;
    webkitSpeechRecognition?: AnySpeechRecognition;
  }
}

export type VoiceState = 'idle' | 'listening' | 'denied' | 'unsupported' | 'error';

export interface VoiceInput {
  /** Whether the browser exposes any SpeechRecognition. */
  supported: boolean;
  /** Current state of the recognizer. */
  state: VoiceState;
  /** Last error message in operator copy (no jargon). */
  errorMessage: string | null;
  /** Interim + final transcript so far in this recording. */
  transcript: string;
  /** Start a new recording. Throws nothing — sets state instead. */
  start: () => void;
  /** Stop the current recording. No-op when idle. */
  stop: () => void;
  /** Toggle start / stop. */
  toggle: () => void;
}

export function useVoiceInput(onFinalTranscript?: (text: string) => void): VoiceInput {
  const SR: AnySpeechRecognition | undefined =
    (typeof window !== 'undefined' ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : undefined);
  const supported = !!SR;
  const [state, setState] = useState<VoiceState>(supported ? 'idle' : 'unsupported');
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;

  // Unmount cleanup — stop any active recording so we don't keep the
  // mic open after the operator leaves the screen.
  useEffect(() => () => {
    if (recRef.current) {
      try { recRef.current.stop(); } catch { /* already stopped */ }
      recRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    try { rec.stop(); } catch { /* no-op */ }
  }, []);

  const start = useCallback(() => {
    if (!SR) { setState('unsupported'); return; }
    if (recRef.current) return; // already listening
    setErrorMessage(null);
    setTranscript('');
    let rec: any;
    try {
      rec = new SR();
    } catch (e) {
      setState('error');
      setErrorMessage('Voice input could not start. The browser blocked it.');
      return;
    }
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';
    rec.onstart = () => {
      setState('listening');
    };
    rec.onresult = (event: any) => {
      let finalText = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setTranscript((prev) => {
        const combined = (prev + finalText).trim();
        return interim ? `${combined} ${interim.trim()}` : combined;
      });
      if (finalText && onFinalRef.current) {
        onFinalRef.current(finalText.trim());
      }
    };
    rec.onerror = (event: any) => {
      const err = (event && event.error) || 'unknown';
      // Honest mapping — every Web Speech error code gets a sentence
      // an operator can act on. No generic "Recognition error".
      const map: Record<string, string> = {
        'not-allowed':       'Microphone access was denied. Allow it in your browser settings and try again.',
        'service-not-allowed':'Microphone access was denied. Allow it in your browser settings and try again.',
        'no-speech':         'I did not hear anything. Try again, closer to the mic.',
        'audio-capture':     'No microphone was found on this device.',
        'network':           'Voice transcription needs a network connection. Check your connection and retry.',
        'aborted':           'Recording cancelled.',
        'language-not-supported': 'This browser does not support voice input for your language yet.',
        'bad-grammar':       'Voice transcription failed. Try again, speaking more clearly.',
      };
      setState(err === 'not-allowed' || err === 'service-not-allowed' ? 'denied' : 'error');
      setErrorMessage(map[err] ?? `Voice input failed: ${err}.`);
    };
    rec.onend = () => {
      recRef.current = null;
      setState((prev) => prev === 'listening' ? 'idle' : prev);
    };
    try {
      rec.start();
      recRef.current = rec;
    } catch (e: any) {
      setState('error');
      setErrorMessage('Voice input could not start. Another recording may be in progress.');
    }
  }, [SR]);

  const toggle = useCallback(() => {
    if (state === 'listening') stop(); else start();
  }, [state, start, stop]);

  return { supported, state, errorMessage, transcript, start, stop, toggle };
}
