import { describe, expect, it } from 'vitest';
import { toClientError } from '../main/errors.js';

describe('toClientError', () => {
  it('maps a plain error to a BUSINESS QUERY_ERROR', () => {
    const err = new Error('syntax error near SELECT');
    expect(toClientError(err)).toEqual({
      type: 'BUSINESS',
      retryable: false,
      code: 'QUERY_ERROR',
      message: 'syntax error near SELECT',
    });
  });

  it('maps cancellation errors to QUERY_CANCELLED', () => {
    expect(toClientError(new Error('query cancelled'))).toMatchObject({ code: 'QUERY_CANCELLED' });
    expect(toClientError(new Error('CANCELLED'))).toMatchObject({ code: 'QUERY_CANCELLED' });
  });

  it('scrubs credentials from the message', () => {
    const err = new Error("Access denied for user 'root'@'localhost' password=supersecret");
    const result = toClientError(err);
    const message = 'message' in result ? (result.message ?? '') : '';
    expect(message).not.toContain('supersecret');
    expect(message).toContain('[REDACTED]');
  });

  it('uses the fallback code when provided', () => {
    const err = new Error('ECONNREFUSED');
    expect(toClientError(err, 'CONNECTION_FAILED')).toMatchObject({ code: 'CONNECTION_FAILED' });
  });

  it('handles non-Error values', () => {
    expect(toClientError('boom')).toMatchObject({ type: 'BUSINESS' });
    expect(toClientError(undefined)).toMatchObject({ type: 'BUSINESS' });
  });
});
