import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type DislikeCategory,
  fetchDislikeCategories,
  saveDislikeCategories,
} from '../../../entities/preference';

function sameIds(left: number[], right: number[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

export function useDislikeCategorySelection() {
  const [options, setOptions] = useState<DislikeCategory[]>([]);
  const [initial, setInitial] = useState<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [maxSelectableCount, setMaxSelectableCount] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchDislikeCategories();
      const ids = result.selectedCategoryIds;
      setOptions(result.categories);
      setInitial(ids);
      setSelected(ids);
      setMaxSelectableCount(result.maxSelectableCount);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '카테고리를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (categoryId: number) =>
    setSelected((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : current.length < maxSelectableCount
          ? [...current, categoryId]
          : current,
    );

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await saveDislikeCategories(selected);
      setInitial(selected);
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : '저장하지 못했습니다. 다시 시도해 주세요.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    options,
    selected,
    maxSelectableCount,
    loading,
    saving,
    error,
    dirty: useMemo(() => !sameIds(initial, selected), [initial, selected]),
    toggle,
    reset: () => setSelected([]),
    load,
    save,
  };
}
