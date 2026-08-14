import { z } from 'zod';

export const clientErrorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('NETWORK'), retryable: z.literal(true), originalError: z.unknown() }),
  z.object({ type: z.literal('TIMEOUT'), retryable: z.literal(true), code: z.string() }),
  z.object({ type: z.literal('BUSINESS'), retryable: z.literal(false), code: z.string(), message: z.string().optional() }),
  z.object({ type: z.literal('VALIDATION'), retryable: z.literal(false), code: z.string(), message: z.string().optional() }),
  z.object({ type: z.literal('UNAUTHORIZED'), retryable: z.literal(true), code: z.string() }),
]);

export type ClientError = z.infer<typeof clientErrorSchema>;

export const resultSchema = <T extends z.ZodType>(data: T) =>
  z.union([
    z.object({ ok: z.literal(true), data }),
    z.object({ ok: z.literal(false), error: clientErrorSchema }),
  ]);

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: ClientError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail<T>(error: ClientError): Result<T> {
  return { ok: false, error };
}
