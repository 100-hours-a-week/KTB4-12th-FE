import { CheckIcon } from '@radix-ui/react-icons';

import { getCategoryIcon } from '../../../entities/category';
import type { DislikeCategory } from '../../../entities/preference';

export function DislikeCategorySelector({
  options,
  selected,
  disabled,
  onToggle,
}: {
  options: DislikeCategory[];
  selected: number[];
  disabled?: boolean;
  onToggle: (categoryId: number) => void;
}) {
  return (
    <div className="category-list">
      {options.map(({ categoryId, name }) => {
        const active = selected.includes(categoryId);
        const Icon = getCategoryIcon(categoryId, name);
        return (
          <button
            type="button"
            className="category-row"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onToggle(categoryId)}
            key={categoryId}
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
  );
}
