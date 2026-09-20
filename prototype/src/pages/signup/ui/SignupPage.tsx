import { CalendarIcon, EyeOpenIcon } from '@radix-ui/react-icons';
import { useState } from 'react';

import { checkEmailAvailability } from '../../../entities/auth';
import { BottomSheet, KeyboardInput } from '../../../mobile';
import { BirthdayFields, FormField } from '../../../shared/ui';

export type SignupDraft = {
  name: string;
  birthday: string;
  email: string;
  emailVerified: boolean;
  password: string;
  passwordConfirmation: string;
};

type SignupPageProps = {
  draft: SignupDraft;
  onDraftChange: (updater: SignupDraft | ((current: SignupDraft) => SignupDraft)) => void;
  onComplete: () => void;
};

export function SignupPage({ draft, onDraftChange, onComplete }: SignupPageProps) {
  const [visible, setVisible] = useState(false);
  const [birthdayPickerOpen, setBirthdayPickerOpen] = useState(false);
  const [pendingBirthday, setPendingBirthday] = useState(draft.birthday || '2000.01.01');
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailError, setEmailError] = useState('');
  const update = <Key extends keyof SignupDraft>(field: Key, value: SignupDraft[Key]) =>
    onDraftChange((current) => ({ ...current, [field]: value }));
  const passwordMatches =
    draft.password.length >= 8 && draft.password === draft.passwordConfirmation;
  const ready =
    draft.name.length > 1 && Boolean(draft.birthday) && draft.emailVerified && passwordMatches;

  const checkEmail = async () => {
    if (emailChecking) return;
    setEmailChecking(true);
    setEmailError('');
    try {
      const available = await checkEmailAvailability(draft.email.trim());
      if (!available) {
        setEmailError('이미 사용 중인 이메일입니다.');
        update('emailVerified', false);
        return;
      }
      update('emailVerified', true);
    } catch (reason) {
      setEmailError(reason instanceof Error ? reason.message : '중복 확인에 실패했습니다.');
      update('emailVerified', false);
    } finally {
      setEmailChecking(false);
    }
  };

  return (
    <section className="page signup-page">
      <p className="brand-title">선잘알</p>
      <FormField label="이름">
        <KeyboardInput
          value={draft.name}
          onChange={(event) => update('name', event.target.value)}
          placeholder="성이름"
        />
      </FormField>
      <div className="form-field">
        <span>생년월일</span>
        <button
          type="button"
          className={`birthday-trigger ${draft.birthday ? 'has-value' : ''}`}
          aria-label="생년월일 선택"
          onClick={() => {
            setPendingBirthday(draft.birthday || '2000.01.01');
            setBirthdayPickerOpen(true);
          }}
        >
          <span>{draft.birthday || 'YYYY.MM.DD'}</span>
          <CalendarIcon />
        </button>
      </div>
      <FormField label="이메일">
        <KeyboardInput
          value={draft.email}
          onChange={(event) =>
            onDraftChange((current) => ({
              ...current,
              email: event.target.value,
              emailVerified: false,
            }))
          }
          placeholder="email@email.com"
        />
        <button
          type="button"
          className="duplicate-check"
          disabled={!draft.email.includes('@') || emailChecking}
          onClick={checkEmail}
        >
          {draft.emailVerified ? '확인 완료' : emailChecking ? '확인 중' : '중복확인'}
        </button>
        {draft.emailVerified ? (
          <small className="field-success">사용할 수 있는 이메일입니다.</small>
        ) : null}
        {emailError ? (
          <small className="field-error" role="alert">
            {emailError}
          </small>
        ) : null}
      </FormField>
      <FormField label="비밀번호">
        <div className="input-with-icon">
          <KeyboardInput
            type={visible ? 'text' : 'password'}
            value={draft.password}
            onChange={(event) => update('password', event.target.value)}
            placeholder="대문자, 특수문자 포함 8자 이상"
          />
          <button
            type="button"
            aria-label="비밀번호 보기"
            onClick={() => setVisible((value) => !value)}
          >
            <EyeOpenIcon />
          </button>
        </div>
      </FormField>
      <FormField label="비밀번호 확인">
        <div className="input-with-icon">
          <KeyboardInput
            aria-label="비밀번호 확인"
            type={visible ? 'text' : 'password'}
            value={draft.passwordConfirmation}
            onChange={(event) => update('passwordConfirmation', event.target.value)}
            placeholder="비밀번호를 다시 입력해 주세요"
          />
          <button
            type="button"
            aria-label="비밀번호 확인 보기"
            onClick={() => setVisible((value) => !value)}
          >
            <EyeOpenIcon />
          </button>
        </div>
        {draft.passwordConfirmation && !passwordMatches ? (
          <small className="field-error">비밀번호가 일치하지 않습니다.</small>
        ) : null}
      </FormField>
      <button
        type="button"
        className="primary signup-submit"
        disabled={!ready}
        onClick={onComplete}
      >
        다음
      </button>
      <BottomSheet
        open={birthdayPickerOpen}
        onOpenChange={setBirthdayPickerOpen}
        title="생년월일 선택"
        description="가입 연령 확인에 사용할 생년월일을 선택해 주세요."
        snap={0.48}
      >
        <BirthdayFields value={pendingBirthday} onChange={setPendingBirthday} />
        <div className="sheet-actions">
          <button type="button" className="secondary" onClick={() => setBirthdayPickerOpen(false)}>
            취소
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              update('birthday', pendingBirthday);
              setBirthdayPickerOpen(false);
            }}
          >
            선택 완료
          </button>
        </div>
      </BottomSheet>
    </section>
  );
}
