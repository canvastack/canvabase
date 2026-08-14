import { z } from 'zod';
import type { Result } from './errors.js';

export const objectNodeSchema = z.object({
  id: z.string(),
  type: z.enum([
    'database',
    'table',
    'view',
    'procedure',
    'trigger',
    'user',
    'schema',
  ]),
  name: z.string(),
  schema: z.string().nullable().default(null),
  columns: z.number().default(0),
  rows: z.number().nullable().default(null),
  isSystem: z.boolean().default(false),
  indexes: z.number().default(0).optional(),
  foreignKeys: z.number().default(0).optional(),
  engine: z.string().nullable().default(null).optional(),
  sizeBytes: z.number().nullable().default(null).optional(),
  updatedAt: z.string().nullable().default(null).optional(),
  createdAt: z.string().nullable().default(null).optional(),
  comment: z.string().nullable().default(null).optional(),
});

export type ObjectNode = z.infer<typeof objectNodeSchema>;
export type ObjectNodeType = ObjectNode['type'];

export type BrowserObjectKind =
  | 'databases'
  | 'tables'
  | 'views'
  | 'procedures'
  | 'triggers'
  | 'users';

export interface BrowserCapabilities {
  databases: boolean;
  views: boolean;
  procedures: boolean;
  triggers: boolean;
  userManagement: boolean;
}

export interface BrowserApi {
  capabilities(connectionId: string): Promise<Result<BrowserCapabilities>>;
  listDatabases(connectionId: string): Promise<Result<ObjectNode[]>>;
  listTables(connectionId: string): Promise<Result<ObjectNode[]>>;
  listViews(connectionId: string): Promise<Result<ObjectNode[]>>;
  listProcedures(connectionId: string): Promise<Result<ObjectNode[]>>;
  listTriggers(connectionId: string): Promise<Result<ObjectNode[]>>;
  listUsers(connectionId: string): Promise<Result<ObjectNode[]>>;
}
