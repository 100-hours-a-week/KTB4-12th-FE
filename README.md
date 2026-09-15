# KTB4-12th-FE

KTB4 12th team frontend application

## 개발 규칙

프로토타입 디렉터리에서 아래 명령을 사용합니다.

```bash
cd prototype
npm ci
npm run check
```

Node.js `24.19.0`과 npm `11.x`를 기준으로 합니다. nvm을 사용한다면 `nvm use`로
`prototype/.nvmrc`의 버전을 적용할 수 있습니다.

- `npm run lint`: ESLint로 React, TypeScript, Hooks 규칙을 검사합니다.
- `npm run lint:fix`: 자동으로 고칠 수 있는 린트 문제를 수정합니다.
- `npm run format`: Prettier로 파일을 정리합니다.
- `npm run format:check`: 포맷 변경 없이 규칙 준수 여부만 검사합니다.
- `npm run typecheck`: TypeScript 타입을 검사합니다.
- `npm run check`: 포맷, 린트, 타입 검사를 차례로 실행합니다.

에디터는 루트의 `.editorconfig`와 `.prettierrc.json`을 기준으로 설정합니다.
커밋 시 Husky가 변경된 파일에 ESLint와 Prettier를 자동 적용한 뒤 전체 빌드를 실행합니다.
두 검사 중 하나라도 실패하면 커밋을 중단합니다.
