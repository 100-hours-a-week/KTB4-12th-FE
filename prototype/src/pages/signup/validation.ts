const SIGNUP_NAME_PATTERN = /^[가-힣A-Za-z](?:[가-힣A-Za-z ]*[가-힣A-Za-z])?$/;
const SIGNUP_PASSWORD_PATTERN =
  /^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=])[A-Za-z0-9!@#$%^&*()_+\-=]+$/;

export const SIGNUP_NAME_ERROR = '이름은 한글 또는 영문으로 1~30자 이내로 입력해 주세요.';
export const SIGNUP_PASSWORD_ERROR = '영문, 숫자, 특수문자를 포함하여 8~64자로 입력해 주세요.';

export function isValidSignupName(name: string) {
  return name.length <= 30 && SIGNUP_NAME_PATTERN.test(name);
}

export function isValidSignupPassword(password: string) {
  return password.length >= 8 && password.length <= 64 && SIGNUP_PASSWORD_PATTERN.test(password);
}
