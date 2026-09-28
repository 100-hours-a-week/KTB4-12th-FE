export type CollectedErrorType = 'error' | 'unhandledrejection' | 'console.error' | 'console.warn';

export interface CollectedError {
  timestamp: string;
  type: CollectedErrorType;
  message: string;
  source?: string;
  line?: number;
  col?: number;
  stack?: string;
}

const MAX_ENTRIES = 20;
const MAX_ITEM_LENGTH = 500;

// 모듈 스코프라 StrictMode 이중 마운트나 HMR 재실행에도 한 번만 설치된다.
let installed = false;
const buffer: CollectedError[] = [];

function truncate(text: string, limit = MAX_ITEM_LENGTH): string {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') return truncate(value);
  if (value instanceof Error) return truncate(value.stack ?? `${value.name}: ${value.message}`);
  try {
    const seen = new WeakSet<object>();
    const text = JSON.stringify(value, (_key, nested: unknown) => {
      if (nested instanceof Error) return `${nested.name}: ${nested.message}`;
      if (typeof nested === 'object' && nested !== null) {
        if (seen.has(nested)) return '[Circular]';
        seen.add(nested);
      }
      return nested;
    });
    return truncate(text ?? String(value));
  } catch {
    return truncate(String(value));
  }
}

function push(entry: CollectedError) {
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
}

function stringifyArgs(args: unknown[]): string {
  return args.map(safeStringify).join(' ');
}

function wrapConsole(method: 'error' | 'warn') {
  /* eslint-disable no-console -- 원래 콘솔 동작을 보존한 채 래핑해야 하므로 console 접근이 필요하다 */
  const original = console[method];
  console[method] = (...args: unknown[]) => {
    push({
      timestamp: new Date().toISOString(),
      type: `console.${method}` as CollectedErrorType,
      message: stringifyArgs(args),
    });
    original.apply(console, args);
  };
  /* eslint-enable no-console */
}

export function installErrorCollector() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    push({
      timestamp: new Date().toISOString(),
      type: 'error',
      message: truncate(event.message),
      source: event.filename || undefined,
      line: event.lineno || undefined,
      col: event.colno || undefined,
      stack: event.error instanceof Error ? truncate(event.error.stack ?? '', 2000) : undefined,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    push({
      timestamp: new Date().toISOString(),
      type: 'unhandledrejection',
      message: safeStringify(event.reason),
      stack: event.reason instanceof Error ? truncate(event.reason.stack ?? '', 2000) : undefined,
    });
  });

  wrapConsole('error');
  wrapConsole('warn');
}

export function getCollectedErrors(): CollectedError[] {
  return [...buffer];
}

export function formatErrorsAsText(): string {
  if (buffer.length === 0) return '수집된 에러가 없습니다.';
  return buffer
    .map((entry) => {
      const location = entry.source
        ? ` (${entry.source}${entry.line ? `:${entry.line}${entry.col ? `:${entry.col}` : ''}` : ''})`
        : '';
      const lines = [`[${entry.timestamp}] [${entry.type}] ${entry.message}${location}`];
      if (entry.stack) lines.push(entry.stack);
      return lines.join('\n');
    })
    .join('\n\n');
}
