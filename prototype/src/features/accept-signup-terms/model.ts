import type { SignupTerm, SignupTermConsent } from '../../entities/auth';
import type { SignupTermId } from './ui/SignupTermsAgreement';

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
