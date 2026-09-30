import { useState } from 'react';

import { KeyboardInput } from '../../../mobile';
import {
  EMAIL_FORMAT_ERROR,
  EMAIL_MAX_LENGTH,
  isValidEmailFormat,
  isValidPassword,
  PASSWORD_FORMAT_ERROR,
  PASSWORD_MAX_LENGTH,
} from '../../../shared/lib/authValidation';
import { FormField } from '../../../shared/ui';

export function LoginPage({
  onLogin,
  onSignup,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const emailInvalid = Boolean(email) && !isValidEmailFormat(email);
  const passwordInvalid = Boolean(password) && !isValidPassword(password);
  const ready = email.trim().length > 0 && password.length > 0;

  const submit = async () => {
    if (submitting || !ready) return;
    setSubmitting(true);
    setError('');
    try {
      await onLogin(email, password);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : '로그인에 실패했습니다. 다시 시도해 주세요.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page signup-page login-page">
      <div className="brand-lockup">
        <img src="/assets/brand/sunjalal-app-icon.png" alt="" aria-hidden="true" />
        <div>
          <h1 className="brand-title">선잘알</h1>
        </div>
      </div>
      <p className="brand-message">선물을 더 쉽게, 마음을 더 가깝게</p>
      <h2 className="login-title">로그인</h2>
      <FormField label="이메일">
        <KeyboardInput
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError('');
          }}
          placeholder="가입한 이메일 주소를 입력해 주세요"
          maxLength={EMAIL_MAX_LENGTH}
          aria-invalid={emailInvalid}
          aria-describedby={emailInvalid ? 'login-email-error' : undefined}
        />
        {emailInvalid ? (
          <small id="login-email-error" className="field-error" role="alert">
            {EMAIL_FORMAT_ERROR}
          </small>
        ) : null}
      </FormField>
      <FormField label="비밀번호">
        <KeyboardInput
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError('');
          }}
          placeholder="영문, 숫자, 특수문자 포함 8~64자"
          maxLength={PASSWORD_MAX_LENGTH}
          aria-invalid={passwordInvalid}
          aria-describedby={passwordInvalid ? 'login-password-error' : undefined}
        />
        {passwordInvalid ? (
          <small id="login-password-error" className="field-error" role="alert">
            {PASSWORD_FORMAT_ERROR}
          </small>
        ) : null}
      </FormField>
      {error ? (
        <p className="login-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="primary signup-submit"
        disabled={submitting || !ready}
        onClick={submit}
      >
        {submitting ? '로그인 중' : '로그인'}
      </button>
      <button type="button" className="text-action" onClick={onSignup}>
        회원가입
      </button>
    </section>
  );
}
