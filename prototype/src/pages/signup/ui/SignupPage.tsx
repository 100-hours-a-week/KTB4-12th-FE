import {
  ArrowLeftIcon,
  CalendarIcon,
  EnvelopeClosedIcon,
  EyeOpenIcon,
} from '@radix-ui/react-icons';
import { useEffect, useRef, useState } from 'react';

import {
  checkEmailAvailability,
  sendEmailVerificationCode,
  verifyEmailCode,
} from '../../../entities/auth';
import { BottomSheet, KeyboardInput } from '../../../mobile';
import { ApiError } from '../../../shared/api/client';
import { BirthdayFields, FormField } from '../../../shared/ui';
import {
  isValidSignupBirthday,
  isValidSignupEmail,
  isValidSignupName,
  isValidSignupPassword,
  latestSignupBirthday,
  SIGNUP_BIRTHDAY_ERROR,
  SIGNUP_EMAIL_ERROR,
  SIGNUP_EMAIL_MAX_LENGTH,
  SIGNUP_NAME_ERROR,
  SIGNUP_NAME_MAX_LENGTH,
  SIGNUP_PASSWORD_ERROR,
  SIGNUP_PASSWORD_MAX_LENGTH,
} from '../validation';

export type SignupDraft = {
  name: string;
  birthday: string;
  email: string;
  emailAvailable: boolean;
  emailVerificationToken: string;
  emailVerificationTokenExpiresAt: number | null;
  emailVerificationSentAt: number | null;
  password: string;
  passwordConfirmation: string;
};

type SignupPageProps = {
  draft: SignupDraft;
  onDraftChange: (updater: SignupDraft | ((current: SignupDraft) => SignupDraft)) => void;
  onBack: () => void;
  onComplete: () => void;
};

export function SignupPage({ draft, onDraftChange, onBack, onComplete }: SignupPageProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmationVisible, setPasswordConfirmationVisible] = useState(false);
  const [birthdayPickerOpen, setBirthdayPickerOpen] = useState(false);
  const [pendingBirthday, setPendingBirthday] = useState(draft.birthday || '2000.01.01');
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [resendUntil, setResendUntil] = useState(() =>
    draft.emailVerificationSentAt == null ? 0 : draft.emailVerificationSentAt + 60_000,
  );
  const emailRequestVersion = useRef(0);
  useEffect(
    () => () => {
      emailRequestVersion.current += 1;
    },
    [],
  );
  const resendSeconds = Math.max(0, Math.ceil((resendUntil - now) / 1000));
  const tokenExpiresAt = draft.emailVerificationTokenExpiresAt ?? 0;
  const emailVerified = Boolean(draft.emailVerificationToken && tokenExpiresAt > now);
  const codeSent = draft.emailVerificationSentAt != null;
  const codeExpiresAt =
    draft.emailVerificationSentAt == null ? 0 : draft.emailVerificationSentAt + 5 * 60_000;
  const codeExpired = !emailVerified && codeExpiresAt > 0 && codeExpiresAt <= now;
  const nextUpdateMs =
    resendSeconds > 0 ? 1000 : emailVerified ? tokenExpiresAt - now : codeExpiresAt - now;
  useEffect(() => {
    if (nextUpdateMs <= 0) return;
    const timeout = window.setTimeout(() => setNow(Date.now()), nextUpdateMs);
    return () => window.clearTimeout(timeout);
  }, [now, nextUpdateMs]);
  const update = <Key extends keyof SignupDraft>(field: Key, value: SignupDraft[Key]) =>
    onDraftChange((current) => ({ ...current, [field]: value }));
  const validName = isValidSignupName(draft.name);
  const validEmailFormat = isValidSignupEmail(draft.email);
  const validVerificationCode = /^\d{6}$/.test(verificationCode);
  const validPassword = isValidSignupPassword(draft.password);
  const passwordMatches =
    Boolean(draft.passwordConfirmation) && draft.password === draft.passwordConfirmation;
  const nameInvalid = Boolean(draft.name) && !validName;
  const emailFormatInvalid = Boolean(draft.email) && !validEmailFormat;
  const passwordInvalid = Boolean(draft.password) && !validPassword;
  const validBirthday = isValidSignupBirthday(draft.birthday);
  const birthdayInvalid = Boolean(draft.birthday) && !validBirthday;
  const pendingBirthdayInvalid = !isValidSignupBirthday(pendingBirthday);
  const ready = validName && validBirthday && emailVerified && validPassword && passwordMatches;

  const checkEmail = async () => {
    if (emailChecking || emailSending || emailVerifying) return;
    const version = ++emailRequestVersion.current;
    setEmailChecking(true);
    setEmailError('');
    try {
      const available = await checkEmailAvailability(draft.email.trim());
      if (version !== emailRequestVersion.current) return;
      onDraftChange((current) => ({
        ...current,
        emailAvailable: available,
        ...(available
          ? {}
          : {
              emailVerificationToken: '',
              emailVerificationTokenExpiresAt: null,
              emailVerificationSentAt: null,
            }),
      }));
      if (!available) {
        setEmailError('이미 사용 중인 이메일입니다.');
      }
    } catch (reason) {
      if (version !== emailRequestVersion.current) return;
      setEmailError(reason instanceof Error ? reason.message : '중복 확인에 실패했습니다.');
    } finally {
      if (version === emailRequestVersion.current) setEmailChecking(false);
    }
  };

  const sendVerificationCode = async () => {
    if (
      !draft.emailAvailable ||
      emailSending ||
      emailVerifying ||
      emailVerified ||
      resendSeconds > 0
    )
      return;
    const version = ++emailRequestVersion.current;
    setEmailSending(true);
    setVerificationError('');
    try {
      await sendEmailVerificationCode(draft.email.trim());
      if (version !== emailRequestVersion.current) return;
      const sentAt = Date.now();
      setNow(sentAt);
      setResendUntil(sentAt + 60_000);
      setVerificationCode('');
      onDraftChange((current) => ({
        ...current,
        emailVerificationToken: '',
        emailVerificationTokenExpiresAt: null,
        emailVerificationSentAt: sentAt,
      }));
    } catch (reason) {
      if (version !== emailRequestVersion.current) return;
      if (reason instanceof ApiError && reason.status === 429) {
        const retryAt = Date.now();
        setNow(retryAt);
        setResendUntil(retryAt + Math.max(1, reason.retryAfterSeconds ?? 60) * 1000);
      }
      setVerificationError(
        reason instanceof Error
          ? reason.message
          : '인증번호 발송에 실패했습니다. 다시 시도해 주세요.',
      );
    } finally {
      if (version === emailRequestVersion.current) setEmailSending(false);
    }
  };

  const verifyCode = async () => {
    if (!validVerificationCode || emailVerifying || emailVerified) return;
    const version = ++emailRequestVersion.current;
    setEmailVerifying(true);
    setVerificationError('');
    try {
      const result = await verifyEmailCode(draft.email.trim(), verificationCode);
      if (version !== emailRequestVersion.current) return;
      const verifiedAt = Date.now();
      setNow(verifiedAt);
      onDraftChange((current) => ({
        ...current,
        emailVerificationToken: result.emailVerificationToken,
        emailVerificationTokenExpiresAt: verifiedAt + result.expiresIn * 1000,
      }));
      setVerificationCode('');
    } catch (reason) {
      if (version !== emailRequestVersion.current) return;
      setVerificationError(
        reason instanceof Error
          ? reason.message
          : '인증번호 확인에 실패했습니다. 다시 시도해 주세요.',
      );
    } finally {
      if (version === emailRequestVersion.current) setEmailVerifying(false);
    }
  };

  return (
    <section className="page signup-page">
      <header className="terms-navigation">
        <button type="button" aria-label="뒤로 가기" onClick={onBack}>
          <ArrowLeftIcon />
        </button>
        <strong>회원가입</strong>
      </header>
      <form
        className="signup-form-body"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) onComplete();
        }}
      >
        <FormField label="이름">
          <KeyboardInput
            value={draft.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="이름을 입력해주세요"
            maxLength={SIGNUP_NAME_MAX_LENGTH}
            aria-invalid={nameInvalid}
            aria-describedby={nameInvalid ? 'signup-name-error' : undefined}
          />
          {nameInvalid ? (
            <small id="signup-name-error" className="field-error" role="alert">
              {SIGNUP_NAME_ERROR}
            </small>
          ) : null}
        </FormField>
        <div className="form-field">
          <span>생년월일</span>
          <button
            type="button"
            className={`birthday-trigger ${draft.birthday ? 'has-value' : ''}`}
            aria-label="생년월일 선택"
            aria-invalid={birthdayInvalid}
            aria-describedby={birthdayInvalid ? 'signup-birthday-error' : undefined}
            onClick={() => {
              setPendingBirthday(draft.birthday || '2000.01.01');
              setBirthdayPickerOpen(true);
            }}
          >
            <span>{draft.birthday || 'YYYY.MM.DD'}</span>
            <CalendarIcon />
          </button>
          {birthdayInvalid ? (
            <small id="signup-birthday-error" className="field-error" role="alert">
              {SIGNUP_BIRTHDAY_ERROR}
            </small>
          ) : null}
        </div>
        <div className="form-field">
          <label htmlFor="signup-email">이메일</label>
          <div className="input-with-icon">
            <KeyboardInput
              id="signup-email"
              value={draft.email}
              onChange={(event) => {
                emailRequestVersion.current += 1;
                setEmailChecking(false);
                setEmailSending(false);
                setEmailVerifying(false);
                setEmailError('');
                setVerificationError('');
                setVerificationCode('');
                setNow(Date.now());
                setResendUntil(0);
                onDraftChange((current) => ({
                  ...current,
                  email: event.target.value,
                  emailAvailable: false,
                  emailVerificationToken: '',
                  emailVerificationTokenExpiresAt: null,
                  emailVerificationSentAt: null,
                }));
              }}
              placeholder="가입에 사용할 이메일 주소를 입력해 주세요"
              maxLength={SIGNUP_EMAIL_MAX_LENGTH}
              aria-invalid={emailFormatInvalid}
              aria-describedby={emailFormatInvalid ? 'signup-email-error' : undefined}
            />
            <button
              type="button"
              className="duplicate-check"
              disabled={!validEmailFormat || emailChecking || emailSending || emailVerifying}
              onClick={checkEmail}
            >
              {emailChecking ? '확인 중' : '중복확인'}
            </button>
          </div>
          {emailFormatInvalid ? (
            <small id="signup-email-error" className="field-error" role="alert">
              {SIGNUP_EMAIL_ERROR}
            </small>
          ) : null}
          {draft.emailAvailable ? (
            <small className="field-success">사용할 수 있는 이메일입니다.</small>
          ) : null}
          {emailError ? (
            <small className="field-error" role="alert">
              {emailError}
            </small>
          ) : null}
          {draft.emailAvailable ? (
            <div className="email-verification">
              {emailVerified ? (
                <p className="email-verification-success" role="status">
                  이메일 인증 완료
                </p>
              ) : (
                <>
                  <div className="email-verification-controls">
                    <button
                      type="button"
                      className="email-verification-send"
                      disabled={emailSending || emailVerifying || resendSeconds > 0}
                      onClick={sendVerificationCode}
                    >
                      {emailSending
                        ? '발송 중…'
                        : resendSeconds > 0
                          ? `재발송 ${resendSeconds}초`
                          : codeSent
                            ? '인증번호 재발송'
                            : '인증번호 발송'}
                    </button>
                    <div className="email-verification-code">
                      <KeyboardInput
                        aria-label="이메일 인증번호"
                        inputMode="numeric"
                        value={verificationCode}
                        onChange={(event) => {
                          setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                          setVerificationError('');
                        }}
                        placeholder="인증번호 6자리"
                        maxLength={6}
                        disabled={!codeSent || emailSending || emailVerifying}
                        aria-invalid={Boolean(verificationError)}
                        aria-describedby={
                          verificationError ? 'signup-email-verification-error' : undefined
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="email-verification-confirm"
                      disabled={!validVerificationCode || emailVerifying || emailSending}
                      onClick={verifyCode}
                    >
                      {emailVerifying ? '확인 중…' : '인증 확인'}
                    </button>
                  </div>
                  <div className="email-verification-note">
                    <span className="email-verification-note-copy">
                      <EnvelopeClosedIcon aria-hidden="true" />
                      <span>
                        {codeExpired
                          ? '인증번호가 만료됐어요. 다시 발송해 주세요.'
                          : codeSent
                            ? '인증번호를 이메일로 보냈어요. 5분 안에 입력해 주세요.'
                            : '인증번호를 이메일로 발송해 인증을 완료해 주세요.'}
                      </span>
                    </span>
                    {resendSeconds > 0 ? (
                      <span className="email-verification-countdown">
                        재발송까지 {resendSeconds}초
                      </span>
                    ) : null}
                  </div>
                </>
              )}
              {verificationError ? (
                <small id="signup-email-verification-error" className="field-error" role="alert">
                  {verificationError}
                </small>
              ) : null}
            </div>
          ) : null}
        </div>
        <FormField label="비밀번호">
          <div className="input-with-icon">
            <KeyboardInput
              type={passwordVisible ? 'text' : 'password'}
              value={draft.password}
              onChange={(event) => update('password', event.target.value)}
              placeholder="영문, 숫자, 특수문자 포함 8~64자"
              maxLength={SIGNUP_PASSWORD_MAX_LENGTH}
              aria-invalid={passwordInvalid}
              aria-describedby={passwordInvalid ? 'signup-password-error' : undefined}
            />
            <button
              type="button"
              aria-label={passwordVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
              onClick={() => setPasswordVisible((value) => !value)}
            >
              <EyeOpenIcon />
            </button>
          </div>
          {passwordInvalid ? (
            <small id="signup-password-error" className="field-error" role="alert">
              {SIGNUP_PASSWORD_ERROR}
            </small>
          ) : null}
        </FormField>
        <FormField label="비밀번호 확인">
          <div className="input-with-icon">
            <KeyboardInput
              aria-label="비밀번호 확인"
              type={passwordConfirmationVisible ? 'text' : 'password'}
              value={draft.passwordConfirmation}
              onChange={(event) => update('passwordConfirmation', event.target.value)}
              placeholder="비밀번호를 다시 입력해 주세요"
              maxLength={SIGNUP_PASSWORD_MAX_LENGTH}
            />
            <button
              type="button"
              aria-label={
                passwordConfirmationVisible ? '비밀번호 확인 숨기기' : '비밀번호 확인 보기'
              }
              onClick={() => setPasswordConfirmationVisible((value) => !value)}
            >
              <EyeOpenIcon />
            </button>
          </div>
          {draft.passwordConfirmation && !passwordMatches ? (
            <small className="field-error">비밀번호가 일치하지 않습니다.</small>
          ) : null}
        </FormField>
        <button type="submit" className="primary signup-submit" disabled={!ready}>
          다음
        </button>
      </form>
      <BottomSheet
        open={birthdayPickerOpen}
        onOpenChange={setBirthdayPickerOpen}
        title="생년월일 선택"
        description="가입 연령 확인에 사용할 생년월일을 선택해 주세요."
        snap={0.48}
      >
        <BirthdayFields
          value={pendingBirthday}
          onChange={setPendingBirthday}
          max={latestSignupBirthday()}
        />
        {pendingBirthdayInvalid ? (
          <small className="field-error" role="alert">
            {SIGNUP_BIRTHDAY_ERROR}
          </small>
        ) : null}
        <div className="sheet-actions">
          <button type="button" className="secondary" onClick={() => setBirthdayPickerOpen(false)}>
            취소
          </button>
          <button
            type="button"
            className="primary"
            disabled={pendingBirthdayInvalid}
            onClick={() => {
              if (!isValidSignupBirthday(pendingBirthday)) return;
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
