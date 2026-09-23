import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { useEffect, useMemo, useState } from 'react';

import { fetchSignupTerms, type SignupTerm, type SignupTermConsent } from '../../../entities/auth';
import {
  type SignupTermId,
  SignupTermsAgreement,
  type TermDetail,
  TermsDetailSheet,
  toAgreementTerms,
} from '../../../features/accept-signup-terms';

export function TermsAgreementPage({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: (consents: SignupTermConsent[]) => Promise<void>;
}) {
  const [signupTerms, setSignupTerms] = useState<SignupTerm[]>([]);
  const [selected, setSelected] = useState<SignupTermId[]>([]);
  const [detail, setDetail] = useState<TermDetail | null>(null);
  const [loadingTerms, setLoadingTerms] = useState(true);
  const [termsError, setTermsError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const terms = useMemo(() => toAgreementTerms(signupTerms), [signupTerms]);
  const requiredIds = terms.filter((term) => term.required).map((term) => term.id);
  const ready = requiredIds.every((id) => selected.includes(id));

  useEffect(() => {
    let cancelled = false;
    setLoadingTerms(true);
    setTermsError('');
    fetchSignupTerms()
      .then((result) => {
        if (cancelled) return;
        setSignupTerms(result);
      })
      .catch((reason) => {
        if (cancelled) return;
        setTermsError(reason instanceof Error ? reason.message : '약관을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoadingTerms(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');
    const consents: SignupTermConsent[] = signupTerms.map((term) => ({
      termId: term.termId,
      version: Number.parseInt(term.version, 10) || 1,
      isAgreed: true,
    }));
    try {
      await onComplete(consents);
    } catch (reason) {
      setSubmitError(
        reason instanceof Error ? reason.message : '회원가입에 실패했습니다. 다시 시도해 주세요.',
      );
      setSubmitting(false);
    }
  };

  return (
    <section className="page terms-page">
      <header className="terms-navigation">
        <button type="button" aria-label="뒤로 가기" onClick={onBack}>
          <ArrowLeftIcon />
        </button>
        <strong>선잘알</strong>
      </header>
      <h1>약관 동의</h1>
      <p className="terms-intro">필수 약관과 선택 동의를 구분하여 확인해 주세요.</p>
      {termsError ? (
        <div className="cursor-status">
          <span>{termsError}</span>
          <button type="button" onClick={() => window.location.reload()}>
            다시 시도
          </button>
        </div>
      ) : loadingTerms ? (
        <p className="cursor-status">약관을 불러오는 중</p>
      ) : (
        <SignupTermsAgreement
          terms={terms}
          selected={selected}
          onChange={setSelected}
          onOpenDetail={setDetail}
        />
      )}
      <div className="terms-page-footer">
        <p>동의하고 회원가입을 완료하면 서비스를 바로 이용할 수 있어요.</p>
        <button
          type="button"
          className="primary terms-continue"
          disabled={!ready || submitting || loadingTerms || Boolean(termsError)}
          onClick={submit}
        >
          {submitting ? '가입 중' : '동의하고 회원가입'}
        </button>
        {submitError ? (
          <p className="field-error" role="alert">
            {submitError}
          </p>
        ) : null}
      </div>
      <TermsDetailSheet detail={detail} onClose={() => setDetail(null)} />
    </section>
  );
}
