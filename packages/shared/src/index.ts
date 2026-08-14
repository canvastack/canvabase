export type SqlPrimitive = string | number | boolean | null | Date | Buffer;

export function isSqlPrimitive(value: unknown): value is SqlPrimitive {
  if (value === null) return true;
  const t = typeof value;
  return (
    t === 'string' ||
    t === 'number' ||
    t === 'boolean' ||
    value instanceof Date ||
    Buffer.isBuffer(value)
  );
}

export function sanitizeLog(value: string): string {
  return value
    .replace(/(password\s*=\s*['"]?)[^'"\s;]+/gi, '$1[REDACTED]')
    .replace(/(?:(pass|pwd|secret|token|key|credential)\b[=:]\s*)\S+/gi, '$1 [REDACTED]');
}

export function snakeToCamel(name: string): string {
  return name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
