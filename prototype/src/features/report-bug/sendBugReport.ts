import { API_BASE_URL } from '../../shared/api/client';
import { loadSession } from '../../shared/api/session';

export type ReportCategory = 'bug' | 'suggestion' | 'help';

export interface BugReportContext {
  reportId: string;
  pageUrl: string;
  route: string;
  viewport: string;
  userAgent: string;
  reportedAt: string;
  errorCount: number;
}

export interface BugReportPayload {
  category: ReportCategory;
  message: string;
  screenshot: Blob | null;
  errorsText: string;
  context: BugReportContext;
}

const CATEGORY_META: Record<ReportCategory, { title: string; label: string; color: number }> = {
  bug: { title: '🐞 버그 제보', label: '버그', color: 0xed5258 },
  suggestion: { title: '💡 제안', label: '제안', color: 0xf1c40f },
  help: { title: '🙋 도움 요청', label: '도움', color: 0x4c9aff },
};

// ⚠️ 보안 주의: VITE_ 접두사 환경변수는 클라이언트 번들에 그대로 포함된다.
// 즉 아래 Discord 웹훅 URL은 빌드 산출물에서 누구나 볼 수 있고,
// 유출 시 누구나 이 채널에 메시지를 보낼 수 있다. 개발 환경에서만 사용하고,
// 프로덕션에서는 반드시 백엔드 프록시(POST /bug-report)로 교체한다.
// 프록시는 아래와 동일한 multipart/form-data(payload_json + files[])를 받도록 만들면
// 이 파일의 ENDPOINT 한 줄만 바꾸면 된다.
const BUG_REPORT_PATH = import.meta.env.VITE_BUG_REPORT_ENDPOINT;
const ENDPOINT: string | undefined = BUG_REPORT_PATH
  ? `${API_BASE_URL}${BUG_REPORT_PATH}`
  : import.meta.env.VITE_DISCORD_WEBHOOK_URL;

const DISCORD_LIMITS = {
  description: 4096,
  fieldValue: 1024,
  embedTotal: 6000,
};

function clamp(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface Embed {
  title: string;
  description: string;
  color: number;
  timestamp: string;
  fields: EmbedField[];
  image?: { url: string };
}

function embedLength(embed: Embed): number {
  return (
    embed.title.length +
    embed.description.length +
    embed.fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0)
  );
}

function buildEmbed(payload: BugReportPayload, screenshotName: string | null): Embed {
  const { context } = payload;
  const meta = CATEGORY_META[payload.category];
  const embed: Embed = {
    title: meta.title,
    description: clamp(payload.message, DISCORD_LIMITS.description),
    color: meta.color,
    timestamp: context.reportedAt,
    fields: [
      { name: '카테고리', value: meta.label, inline: true },
      { name: '제보 ID', value: context.reportId },
      { name: '페이지 URL', value: clamp(context.pageUrl, DISCORD_LIMITS.fieldValue) },
      { name: '라우트', value: clamp(context.route, DISCORD_LIMITS.fieldValue), inline: true },
      { name: '뷰포트', value: clamp(context.viewport, DISCORD_LIMITS.fieldValue), inline: true },
      {
        name: '수집된 에러',
        value: `${context.errorCount}개`,
        inline: true,
      },
      { name: 'User-Agent', value: clamp(context.userAgent, DISCORD_LIMITS.fieldValue) },
      { name: '발생 시각', value: clamp(context.reportedAt, DISCORD_LIMITS.fieldValue) },
    ],
  };
  if (screenshotName) embed.image = { url: `attachment://${screenshotName}` };

  // embed 전체 6000자 제한: 초과분은 description에서 깎는다.
  const overflow = embedLength(embed) - DISCORD_LIMITS.embedTotal;
  if (overflow > 0) {
    embed.description = clamp(embed.description, Math.max(0, embed.description.length - overflow));
  }
  return embed;
}

export async function sendBugReport(payload: BugReportPayload): Promise<void> {
  if (!ENDPOINT) {
    throw new Error('VITE_DISCORD_WEBHOOK_URL이 설정되지 않았습니다.');
  }

  const screenshotName = payload.screenshot
    ? `screenshot.${payload.screenshot.type === 'image/jpeg' ? 'jpg' : 'png'}`
    : null;

  const form = new FormData();
  form.append(
    'payload_json',
    new Blob([JSON.stringify({ embeds: [buildEmbed(payload, screenshotName)] })], {
      type: 'application/json',
    }),
    'payload.json',
  );
  if (payload.screenshot && screenshotName) {
    form.append('files[0]', payload.screenshot, screenshotName);
  }
  form.append('files[1]', new Blob([payload.errorsText], { type: 'text/plain' }), 'errors.txt');

  const accessToken = BUG_REPORT_PATH ? loadSession()?.accessToken : undefined;
  let response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: form,
  });

  // 만료된 토큰 때문에 익명 제보까지 막히지 않도록 인증 없이 한 번만 재시도한다.
  if (response.status === 401 && accessToken) {
    response = await fetch(ENDPOINT, { method: 'POST', body: form });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`전송 실패 (HTTP ${response.status})${body ? `: ${clamp(body, 200)}` : ''}`);
  }
}
