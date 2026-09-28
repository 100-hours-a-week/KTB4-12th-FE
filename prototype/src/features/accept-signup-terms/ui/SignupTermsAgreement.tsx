import { CheckIcon, ChevronRightIcon, Cross1Icon } from '@radix-ui/react-icons';

import type { SignupTerm } from '../../../entities/auth';
import { BottomSheet } from '../../../mobile';

export type SignupTermId = string;

export type TermDetail = { title: string; content: string };

export type AgreementTerm = {
  id: SignupTermId;
  label: string;
  required: boolean;
  detail?: TermDetail;
};

export function toAgreementTerms(signupTerms: SignupTerm[]): AgreementTerm[] {
  return signupTerms.map((term) => ({
    id: term.termCode,
    label: `(${term.isRequired ? '필수' : '선택'}) ${term.title}`,
    required: term.isRequired,
    detail: { title: term.title, content: term.content },
  }));
}

type SignupTermsAgreementProps = {
  terms: AgreementTerm[];
  selected: SignupTermId[];
  onChange: (selected: SignupTermId[]) => void;
  onOpenDetail: (detail: TermDetail) => void;
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

type TermsDetailSheetProps = { detail: TermDetail | null; onClose: () => void };

function TermsDetailContent({ content }: { content: string }) {
  const blocks = content.split(/\n\s*\n/u).filter(Boolean);

  return blocks.map((block, index) => {
    const [heading, ...bodyLines] = block.split('\n');
    if (/^\d+\.\s/u.test(heading)) {
      return (
        <section key={`${index}-${heading}`}>
          <h3>{heading}</h3>
          {bodyLines.length > 0 ? <p>{bodyLines.join('\n')}</p> : null}
        </section>
      );
    }

    return (
      <p className={index === 0 ? 'terms-detail-lead' : undefined} key={`${index}-${heading}`}>
        {block}
      </p>
    );
  });
}

export function TermsDetailSheet({ detail, onClose }: TermsDetailSheetProps) {
  return (
    <BottomSheet
      open={detail !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={detail?.title ?? ''}
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
        <div className="terms-detail-copy">
          {detail ? <TermsDetailContent content={detail.content} /> : null}
        </div>
      </div>
    </BottomSheet>
  );
}
