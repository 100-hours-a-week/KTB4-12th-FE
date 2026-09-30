import { expect, test } from '@playwright/test';

import { mockSignupTerms, type SignupTerm } from '../src/entities/auth/model';
import { toAgreementTerms, toSignupTermConsents } from '../src/features/accept-signup-terms';

const serverTerms = [
  {
    termId: 1,
    termCode: 'PRIVACY_COLLECTION_USE',
    title: '개인정보 수집 및 이용 동의서',
    version: 3,
    isRequired: true,
    content: '필수 약관 본문',
  },
  {
    termId: 2,
    termCode: 'MARKETING',
    title: '마케팅 정보 수신 동의서',
    version: 1,
    isRequired: false,
    content: '선택 약관 본문',
  },
] satisfies SignupTerm[];

test('서버 약관만 필수 여부에 맞게 화면 약관으로 변환한다', () => {
  expect(toAgreementTerms(serverTerms)).toEqual([
    {
      id: 'PRIVACY_COLLECTION_USE',
      label: '(필수) 개인정보 수집 및 이용 동의서',
      required: true,
      detail: 'privacy',
    },
    {
      id: 'MARKETING',
      label: '(선택) 마케팅 정보 수신 동의서',
      required: false,
      detail: undefined,
    },
  ]);
});

test('Mock 약관도 정수 버전의 선택 약관을 제공한다', () => {
  expect(mockSignupTerms).toContainEqual({
    termId: 3,
    termCode: 'MARKETING',
    title: '마케팅 정보 수신 동의서',
    version: 1,
    isRequired: false,
    content: '약관 본문',
  });
});

test('선택하지 않은 선택 약관은 미동의 값으로 가입 요청을 만든다', () => {
  expect(toSignupTermConsents(serverTerms, ['PRIVACY_COLLECTION_USE'])).toEqual([
    { termId: 1, version: 3, isAgreed: true },
    { termId: 2, version: 1, isAgreed: false },
  ]);
});

test('선택한 선택 약관은 동의 값으로 가입 요청을 만든다', () => {
  expect(toSignupTermConsents(serverTerms, ['PRIVACY_COLLECTION_USE', 'MARKETING'])).toEqual([
    { termId: 1, version: 3, isAgreed: true },
    { termId: 2, version: 1, isAgreed: true },
  ]);
});
