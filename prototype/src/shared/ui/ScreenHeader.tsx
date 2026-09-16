import { ArrowLeftIcon } from '@radix-ui/react-icons';
import type { ReactNode } from 'react';

export function ScreenHeader({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="screen-header">
      <div className="header-side">
        {onBack ? (
          <button type="button" className="icon-button" aria-label="뒤로 가기" onClick={onBack}>
            <ArrowLeftIcon />
          </button>
        ) : null}
      </div>
      <h1>{title}</h1>
      <div className="header-side header-action">{action}</div>
    </header>
  );
}
