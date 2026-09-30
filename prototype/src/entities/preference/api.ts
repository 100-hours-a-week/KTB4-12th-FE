import { ApiError, apiGet, apiPut, USE_MOCK_API } from '../../shared/api/client';
import { shouldFailOnce, shouldFailUntilRecovery } from '../../shared/config/qaScenario';

export type DislikeCategory = {
  categoryId: number;
  name: string;
  isSelected: boolean;
};

export type DislikeCategoryOption = {
  maxSelectableCount: number;
  categories: DislikeCategory[];
};

const mockCategoryNames = ['뷰티', '카페/디저트', '패션', '테크', '생활', '취미', '건강', '기타'];

const PREFERENCE_KEY = 'mock-preference';
const DISLIKE_KEY = 'mock-dislike-categories';

function delay(ms = 220) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function fetchPreference(): Promise<string | null> {
  if (USE_MOCK_API) {
    await delay();
    return window.localStorage.getItem(PREFERENCE_KEY);
  }
  const data = await apiGet<{ preference: string | null }>('/preferences');
  return data.preference;
}

export async function savePreference(preference: string | null): Promise<string | null> {
  if (USE_MOCK_API) {
    await delay(300);
    if (preference) window.localStorage.setItem(PREFERENCE_KEY, preference);
    else window.localStorage.removeItem(PREFERENCE_KEY);
    return preference;
  }
  const data = await apiPut<{ preference: string | null }>('/preferences', { preference });
  return data.preference;
}

export async function fetchDislikeCategories(): Promise<DislikeCategoryOption> {
  if (USE_MOCK_API) {
    await delay();
    if (shouldFailUntilRecovery('dislike-category-load-error')) {
      throw new ApiError('카테고리를 불러오지 못했습니다. 다시 시도해 주세요.', 500, {
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
    const selected = new Set(
      JSON.parse(window.localStorage.getItem(DISLIKE_KEY) ?? '[]') as number[],
    );
    return {
      maxSelectableCount: 5,
      categories: mockCategoryNames.map((name, index) => ({
        categoryId: index + 1,
        name,
        isSelected: selected.has(index + 1),
      })),
    };
  }
  return apiGet<DislikeCategoryOption>('/preferences/dislike-categories');
}

export async function saveDislikeCategories(categoryIds: number[]): Promise<number[]> {
  if (USE_MOCK_API) {
    await delay(300);
    if (categoryIds.some((categoryId) => categoryId < 1 || categoryId > mockCategoryNames.length)) {
      throw new ApiError('선택할 수 없는 카테고리입니다.', 422, {
        code: 'DISLIKE_CATEGORY_NOT_AVAILABLE',
      });
    }
    if (shouldFailOnce('dislike-category-save-error')) {
      throw new ApiError('비선호 카테고리를 저장하지 못했습니다. 다시 시도해 주세요.', 500, {
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
    window.localStorage.setItem(DISLIKE_KEY, JSON.stringify(categoryIds));
    return categoryIds;
  }
  const data = await apiPut<{ selectedCategoryIds: number[] }>('/preferences/dislike-categories', {
    categoryIds,
  });
  return data.selectedCategoryIds;
}
