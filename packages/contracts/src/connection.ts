import { z } from 'zod';
import type { Result } from './errors.js';

export const engineSchema = z.enum(['mysql', 'postgresql', 'sqlite']);

export type Engine = z.infer<typeof engineSchema>;

export const credentialModeSchema = z.enum(['NEW', 'EXISTING', 'TEMPORARY']);

export type CredentialMode = z.infer<typeof credentialModeSchema>;

export const sslModeSchema = z.enum(['disabled', 'required', 'verify']);

export const connectionConfigSchema = z.object({
  name: z.string().min(1),
  engine: engineSchema,
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  credentialMode: credentialModeSchema.optional(),
  ssl: sslModeSchema.optional(),
  sshTunnel: z
    .object({
      host: z.string(),
      port: z.number().int().positive().default(22),
      username: z.string(),
    })
    .optional(),
});

export type ConnectionConfig = z.infer<typeof connectionConfigSchema>;

export const connectionSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  engine: engineSchema,
  database: z.string().optional(),
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  username: z.string().optional(),
  status: z.enum(['connected', 'connecting', 'disconnected', 'error']),
});

export type ConnectionSummary = z.infer<typeof connectionSummarySchema>;

export interface ConnectionApi {
  list(): Promise<Result<ConnectionSummary[]>>;
  create(input: ConnectionConfig): Promise<Result<ConnectionSummary>>;
  update(id: string, input: Partial<ConnectionConfig>): Promise<Result<ConnectionSummary>>;
  delete(id: string): Promise<Result<{ deleted: boolean }>>;
  test(input: ConnectionConfig): Promise<Result<{ ok: boolean; latencyMs: number }>>;
  connect(id: string): Promise<Result<ConnectionSummary>>;
  disconnect(id: string): Promise<Result<{ disconnected: boolean }>>;
}
