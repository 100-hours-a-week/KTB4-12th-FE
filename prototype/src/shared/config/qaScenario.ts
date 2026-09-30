export type QaScenario =
  | 'friend-list-error'
  | 'friend-search-error'
  | 'friend-add-error'
  | 'product-list-error'
  | 'product-no-image'
  | 'product-detail-error'
  | 'product-sold-out'
  | 'dislike-category-load-error'
  | 'dislike-category-save-error';

const recoveredScenarios = new Set<QaScenario>();
const attemptedScenarios = new Set<QaScenario>();

export function isQaScenario(scenario: QaScenario) {
  return new URLSearchParams(window.location.search).get('qa') === scenario;
}

export function shouldFailUntilRecovery(scenario: QaScenario) {
  return isQaScenario(scenario) && !recoveredScenarios.has(scenario);
}

export function recoverQaScenario(scenario: QaScenario) {
  recoveredScenarios.add(scenario);
}

export function shouldFailOnce(scenario: QaScenario) {
  if (!isQaScenario(scenario) || attemptedScenarios.has(scenario)) return false;
  attemptedScenarios.add(scenario);
  return true;
}

export function getQaInitialRoute(): 'gifts' | 'preferences' | null {
  const scenario = new URLSearchParams(window.location.search).get('qa') as QaScenario | null;
  if (scenario?.startsWith('product-')) return 'gifts';
  if (scenario?.startsWith('dislike-category-')) return 'preferences';
  return null;
}
