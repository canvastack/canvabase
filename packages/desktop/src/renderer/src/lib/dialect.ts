import type { Engine } from '@canvabase/contracts';
import type { SqlDialect } from './sqlValidator';

export const isMySqlEngine = (engine: Engine): boolean => engine === 'mysql';
export const isPostgresEngine = (engine: Engine): boolean => engine === 'postgresql';
export const isSqliteEngine = (engine: Engine): boolean => engine === 'sqlite';

export function quoteIdent(engine: Engine, name: string): string {
  const parts = name.split('.');
  if (isMySqlEngine(engine)) {
    const q = (p: string) => `\`${p.split('`').join('``')}\``;
    return parts.map(q).join('.');
  }
  const q = (p: string) => `"${p.split('"').join('""')}"`;
  return parts.map(q).join('.');
}

export function quoteLiteral(value: string): string {
  const escaped = value.split('\\').join('\\\\').split("'").join("''");
  return `'${escaped}'`;
}

export function dialectTag(engine: Engine): 'MYSQL' | 'SQLITE' | 'PGSQL' {
  if (isMySqlEngine(engine)) return 'MYSQL';
  if (isSqliteEngine(engine)) return 'SQLITE';
  return 'PGSQL';
}

export function defaultSchemaName(engine: Engine): string {
  if (isSqliteEngine(engine)) return 'main';
  if (isPostgresEngine(engine)) return 'public';
  return 'dbo';
}

export function defaultTablespace(engine: Engine): string {
  if (isPostgresEngine(engine)) return 'pg_default';
  if (isMySqlEngine(engine)) return 'InnoDB';
  return 'main';
}

export function defaultPort(engine: Engine): number {
  return isPostgresEngine(engine) ? 5432 : 3306;
}

export function defaultUsername(engine: Engine): string {
  return isPostgresEngine(engine) ? 'postgres' : 'root';
}

export function toSqlDialect(engine: Engine): SqlDialect {
  if (isMySqlEngine(engine)) return 'mysql';
  if (isPostgresEngine(engine)) return 'postgres';
  if (isSqliteEngine(engine)) return 'sqlite';
  return 'unknown';
}

export function openProcedureSql(engine: Engine, name: string): string {
  if (isMySqlEngine(engine)) return `CALL ${quoteIdent(engine, name)}();`;
  return `SELECT * FROM ${quoteIdent(engine, name)}();`;
}

export function openTriggerSql(engine: Engine, name: string): string {
  if (isMySqlEngine(engine)) return `SHOW CREATE TRIGGER ${quoteIdent(engine, name)};`;
  return `SELECT * FROM information_schema.triggers WHERE trigger_name = ${quoteLiteral(name)};`;
}

export function openUserSql(engine: Engine, name: string): string {
  if (isMySqlEngine(engine)) return `SHOW GRANTS FOR ${quoteLiteral(name)};`;
  return `SELECT * FROM pg_catalog.pg_roles WHERE rolname = ${quoteLiteral(name)};`;
}
