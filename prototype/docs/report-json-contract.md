# 리포트 JSON 접수 전환

POST /bug-report, application/json, credentials include. reportId/description/category/pageUrl/route/viewport/userAgent/reportedAt을 보낸다. 카테고리는 버그/제안/도움으로 변환한다. 사용자 정보는 서버가 결정하며 이미지/에러로그/Discord embeds를 보내지 않는다. 화면 캡처와 제보용 에러 수집기 설치도 제거했다.

202 + data.reportId가 보낸 ID와 같을 때만 접수 성공을 표시한다. 기존204 또는 다른ID 응답은 성공으로 보지 않는다. JWT401 시 같은 JSON을 인증 헤더 없이 한 번 재전송하며 쿠키는 유지한다. 그 외 자동 재시도는 없다.

동일 모달에서 실패 후 같은 내용/카테고리 재시도는 UUID·보고시각·컨텍스트를 포함한 본문 전체를 재사용한다. 내용/카테고리 수정 또는 모달을 닫고 새로 여는 것은 새 제보다. 새로고침/화면 이동까지 초안을 저장하지는 않는다. 전송 중 입력/카테고리 수정·중복 클릭·닫기는 막는다.

UTF-8 직렬화 JSON 전체10KB 초과는 내용 절단 없이 전송 전에 안내한다. 기존 텍스트4000자 제한도 유지하므로 한글4000자는 바이트 제한에 걸릴 수 있다.

백엔드 #547 및 Discord/Sheets Consumer 준비 후 프런트/백엔드를 함께 전환한다. 이전 multipart/204 서버와 호환하지 않는다. 202는 DB 접수이며 외부 전달 완료가 아니다.

검증: tests/e2e/bug-report-auth.spec.ts — 401 동일본문 재시도,503 수동재시도 ID유지/다음 제보 새ID,204/잘못된ID 거부,10KB초과 미전송. 실제 외부 API 발송은 테스트하지 않는다.
