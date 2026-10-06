import { captureReactException } from '@sentry/react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureReactException(error, errorInfo);
    console.error('전역 렌더링 오류', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="global-error-screen" role="alert">
        <div className="global-error-card">
          <span className="global-error-icon" aria-hidden="true">
            ⚠️
          </span>
          <h1>화면을 불러오지 못했어요</h1>
          <p>잠시 후 다시 시도해 주세요.</p>
          {import.meta.env.DEV && this.state.error ? <pre>{this.state.error.message}</pre> : null}
          <button type="button" className="primary" onClick={() => window.location.reload()}>
            새로고침
          </button>
        </div>
      </main>
    );
  }
}
