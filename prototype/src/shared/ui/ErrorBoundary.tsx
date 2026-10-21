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
    const assetLoadFailed =
      /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
        this.state.error?.message ?? '',
      );

    return (
      <main className="global-error-screen" role="alert">
        <div className="global-error-card">
          <span className="global-error-icon" aria-hidden="true">
            ⚠️
          </span>
          <h1>{assetLoadFailed ? '화면 파일을 불러오지 못했어요' : '화면을 불러오지 못했어요'}</h1>
          <p>
            {assetLoadFailed
              ? '새 버전이 배포되었거나 연결이 끊겼을 수 있어요. 인터넷 연결을 확인한 뒤 새로고침해 주세요. 저장하지 않은 입력은 사라질 수 있어요.'
              : '잠시 후 다시 시도해 주세요.'}
          </p>
          {import.meta.env.DEV && this.state.error && !assetLoadFailed ? (
            <pre>{this.state.error.message}</pre>
          ) : null}
          <button type="button" className="primary" onClick={() => window.location.reload()}>
            새로고침
          </button>
        </div>
      </main>
    );
  }
}
