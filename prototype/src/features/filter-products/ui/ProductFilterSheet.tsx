import { CheckIcon, ChevronDownIcon, ChevronRightIcon, Cross1Icon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';

import type { ProductCategory } from '../../../entities/product';
import { BottomSheet } from '../../../mobile';

type ProductFilterSheetProps = {
  open: boolean;
  options: ProductCategory[];
  selected: number[];
  error: string;
  onApply: (categoryIds: number[]) => void;
  onRetry: () => void;
  onOpenChange: (open: boolean) => void;
};

export function ProductFilterSheet({
  open,
  options,
  selected,
  error,
  onApply,
  onRetry,
  onOpenChange,
}: ProductFilterSheetProps) {
  const [draftSelected, setDraftSelected] = useState(selected);
  const [expandedCategoryId, setExpandedCategoryId] = useState<number | null>(null);

  useEffect(() => {
    if (open) setDraftSelected(selected);
  }, [open, selected]);

  const toggleChild = (categoryId: number) => {
    setDraftSelected((current) =>
      current.includes(categoryId)
        ? current.filter((item) => item !== categoryId)
        : [...current, categoryId],
    );
  };

  const apply = () => {
    onApply(draftSelected);
    onOpenChange(false);
  };

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
          className="category-all-row"
          aria-pressed={draftSelected.length === 0}
          onClick={() => setDraftSelected([])}
        >
          <span>전체</span>
          <span className={draftSelected.length === 0 ? 'select-dot active' : 'select-dot'}>
            {draftSelected.length === 0 ? <CheckIcon /> : null}
          </span>
        </button>

        {error ? (
          <div className="category-filter-state" role="alert">
            <p>{error}</p>
            <button type="button" className="secondary" onClick={onRetry}>
              다시 시도
            </button>
          </div>
        ) : null}

        {!error && options.length === 0 ? (
          <p className="category-filter-state">선택할 수 있는 카테고리가 없어요.</p>
        ) : null}

        {options.map((parent) => {
          const expanded = expandedCategoryId === parent.categoryId;
          const selectedCount = parent.children.filter((child) =>
            draftSelected.includes(child.categoryId),
          ).length;

          return (
            <section className="category-group" key={parent.categoryId}>
              <button
                type="button"
                className="category-parent-row"
                aria-expanded={expanded}
                aria-controls={`category-children-${parent.categoryId}`}
                onClick={() =>
                  setExpandedCategoryId((current) =>
                    current === parent.categoryId ? null : parent.categoryId,
                  )
                }
              >
                <span>
                  {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                  {parent.name}
                </span>
                {selectedCount ? <small>{selectedCount}개 선택</small> : null}
              </button>

              {expanded ? (
                <div className="category-children" id={`category-children-${parent.categoryId}`}>
                  {parent.children.map((child) => {
                    const active = draftSelected.includes(child.categoryId);
                    return (
                      <button
                        type="button"
                        className="category-child-row"
                        aria-pressed={active}
                        onClick={() => toggleChild(child.categoryId)}
                        key={child.categoryId}
                      >
                        <span>{child.name}</span>
                        <span className={active ? 'select-box active' : 'select-box'}>
                          {active ? <CheckIcon /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
      <div className="sheet-actions product-filter-actions">
        <button type="button" className="secondary" onClick={() => setDraftSelected([])}>
          초기화
        </button>
        <button type="button" className="primary" onClick={apply}>
          {draftSelected.length ? `${draftSelected.length}개 적용하기` : '전체 상품 보기'}
        </button>
      </div>
    </BottomSheet>
  );
}
