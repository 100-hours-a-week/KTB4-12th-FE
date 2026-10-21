import {
  EMAIL_FORMAT_ERROR,
  EMAIL_MAX_LENGTH,
  isValidEmailFormat,
  isValidPassword,
  PASSWORD_FORMAT_ERROR,
  PASSWORD_MAX_LENGTH,
} from '../../shared/lib/authValidation';

const SIGNUP_NAME_PATTERN = /^[가-힣A-Za-z](?:[가-힣A-Za-z ]*[가-힣A-Za-z])?$/;

export const SIGNUP_NAME_MAX_LENGTH = 30;
export const SIGNUP_EMAIL_MAX_LENGTH = EMAIL_MAX_LENGTH;
export const SIGNUP_PASSWORD_MAX_LENGTH = PASSWORD_MAX_LENGTH;

export const SIGNUP_NAME_ERROR = `한글 또는 영문으로 1~${SIGNUP_NAME_MAX_LENGTH}자 이내로 입력해 주세요.`;
export const SIGNUP_EMAIL_ERROR = EMAIL_FORMAT_ERROR;
export const SIGNUP_PASSWORD_ERROR = PASSWORD_FORMAT_ERROR;

export function isValidSignupName(name: string) {
  return name.length <= SIGNUP_NAME_MAX_LENGTH && SIGNUP_NAME_PATTERN.test(name);
}

export function isValidSignupEmail(email: string) {
  return isValidEmailFormat(email);
}

export function isValidSignupPassword(password: string) {
  return isValidPassword(password);
}

export const SIGNUP_BIRTHDAY_ERROR = '만 14세 이상만 가입할 수 있습니다.';

export function latestSignupBirthday(today = new Date()) {
  const year = today.getFullYear() - 14;
  const month = today.getMonth();
  // Match LocalDate.minusYears: February 29 becomes February 28 in a non-leap year.
  const day = Math.min(today.getDate(), new Date(year, month + 1, 0).getDate());
  return `${year}.${String(month + 1).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
}

export function isValidSignupBirthday(value: string, today = new Date()) {
  if (!/^\d{4}\.\d{2}\.\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('.').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    value <= latestSignupBirthday(today)
  );
}
