import { Cross1Icon } from '@radix-ui/react-icons';

import { BottomSheet } from '../../../mobile';
import { AsyncContentState } from '../../../shared/ui';
import { useDislikeCategorySelection } from '../model/useDislikeCategorySelection';
import { DislikeCategorySelector } from './DislikeCategorySelector';

export function OnboardingPreferenceSheet({
  open,
  onComplete,
  onSkip,
}: {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const selection = useDislikeCategorySelection();
  const save = async () => {
    if (await selection.save()) onComplete();
  };
  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onSkip();
      }}
      title="비선호 카테고리 설정"
      description="선택한 카테고리는 친구들이 선물할 때 경고로 표시됩니다."
      snap={0.94}
    >
      <button
        type="button"
        className="sheet-close"
        aria-label="비선호 카테고리 설정 닫기"
        onClick={onSkip}
      >
        <Cross1Icon />
      </button>
      <AsyncContentState
        loading={selection.loading}
        error={selection.error}
        onRetry={() => void selection.load()}
      />
      {!selection.loading && !selection.error ? (
        <DislikeCategorySelector
          options={selection.options}
          selected={selection.selected}
          disabled={selection.saving}
          onToggle={selection.toggle}
        />
      ) : null}
      <div className="onboarding-actions">
        <button
          type="button"
          className="primary"
          disabled={!selection.selected.length || selection.saving || Boolean(selection.error)}
          onClick={() => void save()}
        >
          {selection.saving ? '저장 중' : '저장하기'}
        </button>
        <button type="button" className="secondary" disabled={selection.saving} onClick={onSkip}>
          나중에 선택하기
        </button>
      </div>
    </BottomSheet>
  );
}
