import { useState } from 'react';

import { KeyboardInput } from '../../../mobile';
import { FormField } from '../../../shared/ui';

export const TEST_ACCOUNT = {
  email: 'test@gift.local',
  password: 'Test1234!',
} as const;

export function LoginPage({
  onLogin,
  onSignup,
}: {
  onLogin: (email: string, password: string) => boolean;
  onSignup: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (onLogin(email, password)) return;
    setError('이메일 또는 비밀번호를 확인해 주세요.');
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
      <button type="button" className="primary signup-submit" onClick={submit}>
        로그인
      </button>
      <p className="login-help">
        테스트 계정
        <br />
        <strong>{TEST_ACCOUNT.email}</strong>
        <br />
        <strong>{TEST_ACCOUNT.password}</strong>
      </p>
      <button type="button" className="text-action" onClick={onSignup}>
        회원가입
      </button>
    </section>
  );
}
