// CanvasErrorBoundary — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup.
//
// React error boundary that contains a thrown render error inside any
// canvas child component (FOV cone math, ConeHandles drag, a new
// drawer section) so the throw never unmounts the whole tree and
// blanks the page to white. Operators get an inline alert with two
// recovery actions (try again / reload page) and the rest of the app
// session survives.
//
// Logging stays on console.error rather than toast because toasts can
// themselves throw — the failure surface must be the simplest code
// path that still gives the operator a way out.

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; label?: string }
interface State { error: Error | null }

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[CanvasErrorBoundary]', this.props.label ?? 'canvas', error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        className="absolute inset-0 z-50 flex items-center justify-center p-6 pointer-events-auto"
        style={{ background: 'var(--background)' }}
      >
        <div
          className="max-w-md rounded-2xl border bg-card p-5 shadow-[0_22px_48px_-16px_rgba(0,0,0,0.55)]"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="text-[13px] font-semibold tracking-tight text-foreground mb-1">
            Canvas hit a render error
          </div>
          <div className="text-[11px] text-muted-foreground leading-snug">
            One of the canvas components threw while rendering. The rest of
            the app is still alive — reload the canvas to recover, or use
            the back button to leave this view.
          </div>
          <pre className="mt-3 text-[10px] font-mono leading-snug whitespace-pre-wrap text-rose-300 max-h-32 overflow-auto">
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => { this.setState({ error: null }); }}
              className="text-[11px] px-2.5 h-7 rounded-md border border-border bg-card text-foreground hover:bg-secondary/40"
            >
              Try render again
            </button>
            <button
              onClick={() => { if (typeof window !== 'undefined') window.location.reload(); }}
              className="text-[11px] px-2.5 h-7 rounded-md bg-primary text-primary-foreground hover:opacity-90"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default CanvasErrorBoundary;
