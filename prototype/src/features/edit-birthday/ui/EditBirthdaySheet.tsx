import { BottomSheet } from '../../../mobile';
import { BirthdayFields } from '../../../shared/ui';

type EditBirthdaySheetProps = {
  open: boolean;
  birthday: string;
  onOpenChange: (open: boolean) => void;
  onBirthdayChange: (value: string) => void;
  onSave: () => void;
};

export function EditBirthdaySheet({
  open,
  birthday,
  onOpenChange,
  onBirthdayChange,
  onSave,
}: EditBirthdaySheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="생년월일 수정"
      snap={0.46}
      description="가입 연령 확인에 사용하는 생년월일을 입력해 주세요."
    >
      <BirthdayFields value={birthday} onChange={onBirthdayChange} />
      <div className="sheet-actions">
        <button type="button" className="secondary" onClick={() => onOpenChange(false)}>
          취소
        </button>
        <button type="button" className="primary" onClick={onSave}>
          저장
        </button>
      </div>
    </BottomSheet>
  );
}
