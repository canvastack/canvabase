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
  let out = value;
  out = out.replace(
    /(["']?)\b(pass(?:word)?|pwd|secret|token|api[_-]?key|key|credential)\b(["']?)\s*[:=]\s*["']?[^"'\s;,&]+/gi,
    '$1$2$3[REDACTED]',
  );
  out = out.replace(/(\w+:\/\/[^:\s/@]+:)[^@\s/]+@/g, '$1[REDACTED]@');
  out = out.replace(/(\bAuthorization\s*:\s*Bearer\s+)\S+/gi, '$1[REDACTED]');
  return out;
}

export function snakeToCamel(name: string): string {
  return name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
