import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncValue, StatementSync } from 'node:sqlite';
import type { constants as sqliteConstants } from 'node:sqlite';

const require = createRequire(import.meta.url);
const sqlite = require('node:sqlite') as {
  DatabaseSync: typeof DatabaseSyncValue;
  constants: typeof sqliteConstants;
};

export const DatabaseSync = sqlite.DatabaseSync;
export const constants = sqlite.constants;
export type { StatementSync };
