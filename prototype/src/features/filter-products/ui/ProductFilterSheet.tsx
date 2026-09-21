import { ArchiveIcon, CheckIcon, Cross1Icon } from '@radix-ui/react-icons';

import { categories as categoryIcons } from '../../../entities/category';
import { BottomSheet } from '../../../mobile';

type ProductFilterSheetProps = {
  open: boolean;
  options: Array<{ categoryId: number; name: string }>;
  selected: number[];
  onToggle: (categoryId: number) => void;
  onClear: () => void;
  onOpenChange: (open: boolean) => void;
};

export function ProductFilterSheet({
  open,
  options,
  selected,
  onToggle,
  onClear,
  onOpenChange,
}: ProductFilterSheetProps) {
  const iconFor = (name: string) =>
    categoryIcons.find((category) => category.name === name)?.Icon ?? ArchiveIcon;

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="카테고리 필터" snap={0.75}>
      <button
        type="button"
        className="sheet-close"
        aria-label="카테고리 필터 닫기"
        onClick={() => onOpenChange(false)}
      >
        <Cross1Icon />
      </button>
      <div className="sheet-category-list">
        <button
          type="button"
          className="category-row"
          aria-pressed={selected.length === 0}
          onClick={onClear}
        >
          <span>전체</span>
          <span className={selected.length === 0 ? 'select-dot active' : 'select-dot'}>
            {selected.length === 0 ? <CheckIcon /> : null}
          </span>
        </button>
        {options.map(({ categoryId, name }) => {
          const active = selected.includes(categoryId);
          const Icon = iconFor(name);
          return (
            <button
              type="button"
              className="category-row"
              aria-pressed={active}
              onClick={() => onToggle(categoryId)}
              key={categoryId}
            >
              <span>
                <Icon />
                {name}
              </span>
              <span className={active ? 'select-dot active' : 'select-dot'}>
                {active ? <CheckIcon /> : null}
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" className="primary sheet-submit" onClick={() => onOpenChange(false)}>
        적용하기
      </button>
    </BottomSheet>
  );
}
