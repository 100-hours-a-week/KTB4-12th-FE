import { useEffect, useRef } from 'react';

type InfiniteCursorProps = {
  itemCount: number;
  emptyLabel: string;
  hasNext: boolean;
  loading: boolean;
  error: string | null;
  onLoadMore: () => void;
  onRetry: () => void;
};

export function InfiniteCursor({
  itemCount,
  emptyLabel,
  hasNext,
  loading,
  error,
  onLoadMore,
  onRetry,
}: InfiniteCursorProps) {
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = target.current;
    if (!element || !hasNext || loading || error) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      { rootMargin: '120px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [error, hasNext, loading, onLoadMore]);

  return (
    <div ref={target} className="cursor-status" aria-live="polite">
      {error ? (
        <>
          <span>{error}</span>
          <button type="button" onClick={onRetry}>
            다시 시도
          </button>
        </>
      ) : loading ? (
        <>
          <span className="loading-dot" />
          목록을 불러오는 중
        </>
      ) : itemCount === 0 ? (
        emptyLabel
      ) : hasNext ? (
        '아래로 스크롤하면 더 불러와요'
      ) : (
        '목록의 끝이에요'
      )}
    </div>
  );
}
