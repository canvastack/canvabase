import { describe, expect, it } from 'vitest';
import { isSqlPrimitive, sanitizeLog, snakeToCamel } from './index';

describe('isSqlPrimitive', () => {
  it('accepts primitives and null', () => {
    expect(isSqlPrimitive(null)).toBe(true);
    expect(isSqlPrimitive('x')).toBe(true);
    expect(isSqlPrimitive(42)).toBe(true);
    expect(isSqlPrimitive(false)).toBe(true);
    expect(isSqlPrimitive(new Date())).toBe(true);
  });
  it('rejects objects and undefined', () => {
    expect(isSqlPrimitive(undefined)).toBe(false);
    expect(isSqlPrimitive({})).toBe(false);
    expect(isSqlPrimitive([])).toBe(false);
  });
});

describe('sanitizeLog', () => {
  it('redacts password values', () => {
    expect(sanitizeLog('password=supersecret;')).toContain('[REDACTED]');
    expect(sanitizeLog('password=supersecret;')).not.toContain('supersecret');
  });
  it('redacts colon form and JSON values', () => {
    expect(sanitizeLog('password: supersecret')).toContain('[REDACTED]');
    expect(sanitizeLog('password: supersecret')).not.toContain('supersecret');
    expect(sanitizeLog('{"password":"hunter2"}')).toContain('[REDACTED]');
    expect(sanitizeLog('{"password":"hunter2"}')).not.toContain('hunter2');
  });
  it('redacts DSN and Bearer credentials', () => {
    expect(sanitizeLog('mysql://root:toor@host/db')).toContain('[REDACTED]@host');
    expect(sanitizeLog('mysql://root:toor@host/db')).not.toContain('toor');
    expect(sanitizeLog('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9')).toContain('[REDACTED]');
    expect(sanitizeLog('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9')).not.toContain('eyJhbGci');
  });
});

describe('snakeToCamel', () => {
  it('converts snake_case', () => {
    expect(snakeToCamel('created_at')).toBe('createdAt');
    expect(snakeToCamel('user_id')).toBe('userId');
  });
});
