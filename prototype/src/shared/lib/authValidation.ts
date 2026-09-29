// 백엔드 SignupRequest/LoginRequest의 이메일·비밀번호 제약과 동일하게 맞춘 값이다.
// 백엔드 제약이 바뀌면 이 파일만 갱신하면 로그인/회원가입 화면에 함께 반영된다.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN =
  /^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=])[A-Za-z0-9!@#$%^&*()_+\-=]+$/;

export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

export const EMAIL_FORMAT_ERROR = '올바른 이메일 형식으로 입력해 주세요. (예: name@email.com)';
export const PASSWORD_FORMAT_ERROR = `영문, 숫자, 특수문자(!@#$%^&*()_+-=)를 모두 포함해 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자로 입력해 주세요.`;

export function isValidEmailFormat(email: string) {
  return email.length > 0 && email.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(email);
}

export function isValidPassword(password: string) {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    PASSWORD_PATTERN.test(password)
  );
}
