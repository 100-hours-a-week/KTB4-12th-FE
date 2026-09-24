import { CheckIcon, ChevronRightIcon, Cross1Icon } from '@radix-ui/react-icons';

import { BottomSheet } from '../../../mobile';
import type { AgreementTerm, SignupTermId } from '../model';

type SignupTermsAgreementProps = {
  terms: AgreementTerm[];
  selected: SignupTermId[];
  onChange: (selected: SignupTermId[]) => void;
  onOpenDetail: (detail: 'privacy' | 'giftHistory') => void;
};

export function SignupTermsAgreement({
  terms,
  selected,
  onChange,
  onOpenDetail,
}: SignupTermsAgreementProps) {
  const allSelected = selected.length === terms.length;
  const toggle = (id: SignupTermId) =>
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);

  return (
    <fieldset className="terms-list">
      <legend className="sr-only">약관 선택</legend>
      <label className="terms-row terms-all-row">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => onChange(allSelected ? [] : terms.map(({ id }) => id))}
        />
        <span className="terms-check" aria-hidden="true">
          {allSelected ? <CheckIcon /> : null}
        </span>
        <span>전체 동의</span>
      </label>
      {terms.map((term) => (
        <div className="terms-row" key={term.id}>
          <label className="terms-label">
            <input
              type="checkbox"
              checked={selected.includes(term.id)}
              onChange={() => toggle(term.id)}
            />
            <span className="terms-check" aria-hidden="true">
              {selected.includes(term.id) ? <CheckIcon /> : null}
            </span>
            <span>{term.label}</span>
          </label>
          {term.detail ? (
            <button
              type="button"
              className="terms-detail-button"
              aria-label={`${term.label} 상세 보기`}
              onClick={() => onOpenDetail(term.detail!)}
            >
              <ChevronRightIcon />
            </button>
          ) : (
            <ChevronRightIcon className="terms-detail-placeholder" aria-hidden="true" />
          )}
        </div>
      ))}
    </fieldset>
  );
}

type TermsDetailSheetProps = { kind: 'privacy' | 'giftHistory' | null; onClose: () => void };

const privacySections = [
  [
    '1. 수집하는 개인정보',
    '회원가입 및 계정 관리를 위해 이름, 생년월일, 이메일 주소와 비밀번호를 필수로 수집합니다. 생년월일은 가입일 기준 만 14세 이상 여부를 확인하는 데 사용합니다. 이름은 서비스 내 사용자 식별에 사용되며, 나를 친구로 등록한 사용자에게 항상 표시됩니다.',
  ],
  [
    '2. 수집·이용 목적',
    '계정 관리, 만 14세 이상 확인, 친구 검색·목록 및 선물 수신자 식별에 이용합니다. 생일 공개는 최초 로그인에서 별도 동의받습니다.',
  ],
  [
    '3. 보유 및 이용 기간',
    '회원 탈퇴 시까지 보유·이용하며, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 안전하게 보관합니다.',
  ],
  [
    '4. 동의 거부 권리',
    '동의를 거부할 수 있습니다. 다만 이름·생년월일·이메일·비밀번호는 회원가입에 필요한 필수 정보이므로 미동의 시 회원가입이 제한됩니다.',
  ],
] as const;

const giftHistorySections = [
  ['1. 수집하는 정보', '선물 발송·수신 처리에 필요한 송수신 이력과 주문 정보를 수집·이용합니다.'],
  [
    '2. 수집·이용 목적',
    '선물 발송·수신 처리, 내역 조회, 중복 선물 안내 등 기본 서비스 제공에 이용합니다.',
  ],
  [
    '3. 보유 및 이용 기간',
    '회원 탈퇴 또는 동의 철회 시까지 이용하며, 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.',
  ],
  ['4. 동의 거부 권리', '필수 정보로서 미동의 시 선물 송수신 기능 이용이 제한됩니다.'],
] as const;

export function TermsDetailSheet({ kind, onClose }: TermsDetailSheetProps) {
  const privacy = kind === 'privacy';
  const sections = privacy ? privacySections : giftHistorySections;
  return (
    <BottomSheet
      open={kind !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={privacy ? '개인정보 수집 및 이용 동의서' : '선물 송수신 이력 정보 동의서'}
      snap={0.85}
    >
      <button
        type="button"
        className="sheet-close terms-sheet-close"
        aria-label="약관 상세 닫기"
        onClick={onClose}
      >
        <Cross1Icon />
      </button>
      <div className="terms-detail-body">
        <p className="terms-detail-lead">
          {privacy ? '필수 개인정보 수집 및 이용 안내' : '필수 선물 이력 정보 수집 및 이용 안내'}
        </p>
        <div className="terms-detail-copy">
          {sections.map(([heading, copy]) => (
            <section key={heading}>
              <h3>{heading}</h3>
              <p>{copy}</p>
            </section>
          ))}
        </div>
        <p className="terms-detail-footnote">
          {privacy
            ? '상세 내용은 서비스 개인정보 처리방침에서 확인할 수 있습니다.'
            : '리뷰·별점과 AI 모델 개선 목적은 포함하지 않습니다.'}
        </p>
      </div>
    </BottomSheet>
  );
}
