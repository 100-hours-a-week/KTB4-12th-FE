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
  // onLoadMore는 렌더마다 새로 만들어지는 클로저라, 이걸 effect deps에 그대로 넣으면
  // 매 렌더마다 옵저버를 재구독하게 된다. 센티널이 이미 뷰포트 안에 있으면 재구독 즉시
  // isIntersecting:true 콜백이 다시 터져서, 필터/정렬이 막 바뀌어 아직 커서가 리셋되지
  // 않은 렌더에서 "이전 커서 + 새 조건"으로 loadMore가 새치기하는 레이스가 생긴다.
  // ref로 최신 콜백만 갈아끼우고 옵저버 자체는 hasNext/loading/error에만 반응하게 한다.
  const onLoadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const element = target.current;
    if (!element || !hasNext || loading || error) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMoreRef.current();
      },
      { rootMargin: '120px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [error, hasNext, loading]);

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
