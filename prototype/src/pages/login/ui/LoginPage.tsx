import { useState } from 'react';

import { KeyboardInput } from '../../../mobile';
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

  const submit = async () => {
    if (submitting) return;
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
          <span>SUNJALAL</span>
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
          placeholder="email@email.com"
        />
      </FormField>
      <FormField label="비밀번호">
        <KeyboardInput
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError('');
          }}
          placeholder="비밀번호를 입력해 주세요"
        />
      </FormField>
      {error ? (
        <p className="login-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="primary signup-submit"
        disabled={submitting}
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
