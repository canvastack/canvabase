import type { ClientError, Result } from '@canvabase/contracts';
import { fail } from '@canvabase/contracts';
import { sanitizeLog } from '@canvabase/shared';

const CANCELLED_CODES = ['cancelled', 'cancelled query', 'mysql: not connected'];

export function toClientError(err: unknown, fallbackCode = 'QUERY_ERROR'): ClientError {
  if (err instanceof Error) {
    const message = sanitizeLog(err.message);
    const cancelled = CANCELLED_CODES.some((code) => err.message.toLowerCase().includes(code));
    if (cancelled) {
      return { type: 'BUSINESS', retryable: false, code: 'QUERY_CANCELLED', message };
    }
    return {
      type: 'BUSINESS',
      retryable: false,
      code: fallbackCode,
      ...(message.length > 0 ? { message } : {}),
    };
  }
  return { type: 'BUSINESS', retryable: false, code: fallbackCode };
}

export function failUnsupported<T>(): Result<T> {
  return fail<T>({ type: 'BUSINESS', retryable: false, code: 'UNSUPPORTED_OPERATION' });
}
