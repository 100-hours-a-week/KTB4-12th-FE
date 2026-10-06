export function AsyncContentState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading)
    return (
      <div className="cursor-status">
        <span className="loading-dot" /> 불러오는 중
      </div>
    );
  if (!error) return null;
  return (
    <div className="cursor-status" role="alert">
      <span>{error}</span>
      <button type="button" onClick={onRetry}>
        다시 시도
      </button>
    </div>
  );
}
