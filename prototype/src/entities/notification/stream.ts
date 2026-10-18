import { apiPatch, apiStream, USE_MOCK_API } from '../../shared/api/client';
import { getSessionVersion, loadSession } from '../../shared/api/session';
import type { Notification } from './api';

function parseNotification(
  frame: string,
): { notification: Notification; deliveryId: string | null } | null {
  const lines = frame.split(/\r?\n/);
  if (!lines.includes('event:notification') && !lines.includes('event: notification')) return null;
  try {
    const value = JSON.parse(
      lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''))
        .join('\n'),
    );
    if (
      !value ||
      !Number.isSafeInteger(value.notificationId) ||
      value.notificationId <= 0 ||
      typeof value.type !== 'string' ||
      typeof value.title !== 'string' ||
      typeof value.message !== 'string' ||
      typeof value.isRead !== 'boolean' ||
      typeof value.notifiedAt !== 'string' ||
      !(value.referenceType === null || typeof value.referenceType === 'string') ||
      !(value.referenceId === null || Number.isSafeInteger(value.referenceId))
    )
      return null;
    const deliveryId = lines
      .find((line) => line.startsWith('id:'))
      ?.slice(3)
      .trim();
    return {
      notification: value,
      deliveryId: deliveryId && /^[1-9][0-9]*$/.test(deliveryId) ? deliveryId : null,
    };
  } catch {
    return null;
  }
}

export function subscribeNotifications(
  onNotification: (notification: Notification) => void,
  onConnected: () => void,
) {
  if (USE_MOCK_API || !loadSession()) return () => {};
  const controller = new AbortController();
  const version = getSessionVersion();
  let retryTimer: number | undefined;
  const active = () =>
    !controller.signal.aborted && version === getSessionVersion() && Boolean(loadSession());

  const connect = async () => {
    const seen = new Set<number>();
    try {
      const response = await apiStream('/notifications/events', {}, { signal: controller.signal });
      if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body)
        return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        if (active()) onConnected();
        while (active()) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary: RegExpExecArray | null;
          while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
            const event = parseNotification(buffer.slice(0, boundary.index));
            buffer = buffer.slice(boundary.index + boundary[0].length);
            if (!active() || !event) continue;
            const { notification, deliveryId } = event;
            if (!notification.isRead && !seen.has(notification.notificationId)) {
              onNotification(notification);
              seen.add(notification.notificationId);
            }
            // ACK 응답이 유실되어 재수신한 이벤트도 다시 확인한다.
            if (deliveryId && active()) {
              void apiPatch(`/notifications/events/${deliveryId}/ack`).catch(() => undefined);
            }
          }
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    } catch {
      // Network failures reconnect; authentication failures use the shared session handling.
    } finally {
      if (active()) retryTimer = window.setTimeout(() => void connect(), 3000);
    }
  };
  void connect();
  return () => {
    controller.abort();
    window.clearTimeout(retryTimer);
  };
}
