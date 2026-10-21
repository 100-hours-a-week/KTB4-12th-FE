import { BellIcon } from '@radix-ui/react-icons';

export function NotificationButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      className="icon-button notification-button"
      aria-label={`알림 ${count}개, 알림 목록 열기`}
      onClick={onClick}
    >
      <BellIcon />
      {count > 0 ? <span>{count > 99 ? '99+' : count}</span> : null}
    </button>
  );
}
