import type { SignupTerm, SignupTermConsent } from '../../entities/auth';

export type SignupTermId = string;

export type AgreementTerm = {
  id: SignupTermId;
  label: string;
  required: boolean;
  detail?: 'privacy' | 'giftHistory';
};

export function toAgreementTerms(signupTerms: SignupTerm[]): AgreementTerm[] {
  const detailByCode: Record<string, 'privacy' | 'giftHistory'> = {
    PRIVACY_COLLECTION_USE: 'privacy',
    GIFT_HISTORY_DATA_USE: 'giftHistory',
  };

  return signupTerms.map((term) => ({
    id: term.termCode,
    label: `(${term.isRequired ? '필수' : '선택'}) ${term.title}`,
    required: term.isRequired,
    detail: detailByCode[term.termCode],
  }));
}

export function toSignupTermConsents(
  signupTerms: SignupTerm[],
  selected: SignupTermId[],
): SignupTermConsent[] {
  return signupTerms.map((term) => ({
    termId: term.termId,
    version: term.version,
    isAgreed: selected.includes(term.termCode),
  }));
}
