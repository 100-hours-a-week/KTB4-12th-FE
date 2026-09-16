import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { useState } from 'react';

import {
  REQUIRED_TERM_IDS,
  type SignupTermId,
  SignupTermsAgreement,
  TermsDetailSheet,
} from '../../../features/accept-signup-terms';

export function TermsAgreementPage({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: () => void;
}) {
  const [selected, setSelected] = useState<SignupTermId[]>([]);
  const [detail, setDetail] = useState<'privacy' | 'giftHistory' | null>(null);
  const ready = REQUIRED_TERM_IDS.every((id) => selected.includes(id));

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
      <SignupTermsAgreement selected={selected} onChange={setSelected} onOpenDetail={setDetail} />
      <div className="terms-page-footer">
        <p>필수 약관만 동의해도 회원가입과 기본 기능을 이용할 수 있습니다.</p>
        <button
          type="button"
          className="primary terms-continue"
          disabled={!ready}
          onClick={onComplete}
        >
          동의하고 회원가입
        </button>
      </div>
      <TermsDetailSheet kind={detail} onClose={() => setDetail(null)} />
    </section>
  );
}
