import { API_BASE_URL } from '../../shared/api/client';
import { loadSession } from '../../shared/api/session';

export type ReportCategory = 'bug' | 'suggestion' | 'help';

export interface BugReportPayload {
  reportId: string;
  description: string;
  category: ReportCategory;
  pageUrl: string;
  route: string;
  viewport: string;
  userAgent: string;
  reportedAt: string;
}

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  bug: '버그',
  suggestion: '제안',
  help: '도움',
};
const BUG_REPORT_PATH = import.meta.env.VITE_BUG_REPORT_ENDPOINT;
const ENDPOINT = BUG_REPORT_PATH ? `${API_BASE_URL}${BUG_REPORT_PATH}` : null;

export async function sendBugReport(payload: BugReportPayload): Promise<void> {
  if (!ENDPOINT) throw new Error('의견 접수를 사용할 수 없어요. 잠시 후 다시 시도해 주세요.');
  const body = JSON.stringify({ ...payload, category: CATEGORY_LABELS[payload.category] });
  if (new TextEncoder().encode(body).byteLength > 10 * 1024) {
    throw new Error('의견 내용이 너무 길어요. 내용을 줄여 주세요.');
  }
  const accessToken = loadSession()?.accessToken;
  const send = (token?: string) =>
    fetch(ENDPOINT, {
      credentials: 'include',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    }).catch(() => {
      throw new Error('접수를 확인하지 못했어요. 다시 시도해 주세요.');
    });
  let response = await send(accessToken);
  // 만료된 토큰이어도 동일 ID와 본문으로 익명 접수를 한 번 시도한다.
  if (response.status === 401 && accessToken) response = await send();
  if (response.status === 429) throw new Error('요청이 많아요. 잠시 후 다시 시도해 주세요.');
  if (response.status !== 202) {
    throw new Error('접수를 확인하지 못했어요. 다시 시도해 주세요.');
  }
  const accepted: unknown = await response.json().catch(() => null);
  if (
    !accepted ||
    typeof accepted !== 'object' ||
    !('data' in accepted) ||
    !accepted.data ||
    typeof accepted.data !== 'object' ||
    !('reportId' in accepted.data) ||
    accepted.data.reportId !== payload.reportId
  ) {
    throw new Error('접수를 확인하지 못했어요. 다시 시도해 주세요.');
  }
}
