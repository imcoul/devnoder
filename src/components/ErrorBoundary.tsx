import { Component, ReactNode } from 'react';
import './ErrorBoundary.css';

interface Props { children: ReactNode }
interface State { error: Error | null }

// Nothing in the app previously caught a render-time throw (WASM load
// failure, a GitService exception, etc.) — an uncaught error white-screened
// the app with no fallback, which is both a reliability and an
// accessibility failure for the stated screen-reader/low-vision audience.
// Logging stays local (console only) — no telemetry, matching the rest of
// the app's zero-telemetry-by-default stance.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary" role="alert">
          <span className="error-boundary__icon" aria-hidden="true">⚠</span>
          <h1 className="error-boundary__title">Something went wrong</h1>
          <p className="error-boundary__message">{this.state.error.message}</p>
          <button
            type="button"
            className="error-boundary__reload"
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          >
            Reload DevNoder
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
