import { CheckIcon } from '@radix-ui/react-icons';
import { useEffect, useRef, useState } from 'react';

import { getCategoryIcon } from '../../../entities/category';
import type { DislikeCategory } from '../../../entities/preference';
import { useScreenPortal } from '../../../mobile';
import { Toast } from '../../../shared/ui';

export function DislikeCategorySelector({
  options,
  selected,
  disabled,
  onToggle,
  limitReached,
  onReset,
  maxSelectableCount,
}: {
  options: DislikeCategory[];
  selected: number[];
  disabled?: boolean;
  limitReached: boolean;
  onReset?: () => void;
  maxSelectableCount: number;
  onToggle: (categoryId: number) => void;
}) {
  const { screenRef } = useScreenPortal();
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const clearToast = () => {
    clearTimeout(toastTimer.current);
    setToast(null);
  };
  const toggle = (categoryId: number) => {
    clearToast();
    if (!selected.includes(categoryId) && selected.length >= maxSelectableCount) {
      setToast(
        `비선호 카테고리는 최대 ${maxSelectableCount}개까지 선택할 수 있어요. 기존 선택을 해제해 주세요.`,
      );
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    }
    onToggle(categoryId);
  };
  return (
    <>
      <div className="preference-toolbar">
        <span role="status" className={limitReached ? 'preference-limit' : undefined}>
          {limitReached
            ? `최대 ${maxSelectableCount}개 · 다른 항목을 선택하려면 먼저 해제해 주세요`
            : `${selected.length} / ${maxSelectableCount}개 선택`}
        </span>
        {onReset ? (
          <button
            type="button"
            disabled={!selected.length || disabled}
            onClick={() => {
              clearToast();
              onReset();
            }}
          >
            전체 해제
          </button>
        ) : null}
      </div>
      <div className="category-list">
        {options.map(({ categoryId, name }) => {
          const active = selected.includes(categoryId);
          const Icon = getCategoryIcon(categoryId, name);
          return (
            <button
              key={categoryId}
              type="button"
              className="category-row"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => toggle(categoryId)}
            >
              <span>
                <Icon /> {name}
              </span>
              <span className={active ? 'select-dot active' : 'select-dot'}>
                {active ? <CheckIcon /> : null}
              </span>
            </button>
          );
        })}
      </div>
      <Toast message={toast} container={screenRef.current} />
    </>
  );
}
